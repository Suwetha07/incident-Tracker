import base64
import os
import tempfile
from pathlib import Path
from typing import Any, Optional

import httpx
import yaml
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="API Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORKSPACE_TEMP_DIR = Path(__file__).resolve().parents[1] / ".backend-logs" / "tmp"


@app.get("/health")
async def health():
    return {"status": "ok"}


class ClusterValidationRequest(BaseModel):
    tenantId: Optional[str] = None
    clientId: Optional[str] = None
    clientSecret: Optional[str] = None
    subscriptionId: str = Field(..., min_length=1)
    resourceGroup: str = Field(..., min_length=1)
    aksClusterName: str = Field(..., min_length=1)
    accessToken: Optional[str] = None


class KubeconfigValidationRequest(BaseModel):
    kubeconfig: str = Field(..., min_length=1)


def azure_error_message(payload: Any, fallback: str) -> str:
    if isinstance(payload, dict):
        error_description = payload.get("error_description")
        if error_description:
            return str(error_description)

        error = payload.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or fallback)
        if error:
            return str(error)

        message = payload.get("message")
        if message:
            return str(message)

    return fallback


def response_payload(response: httpx.Response) -> Any:
    try:
        return response.json()
    except ValueError:
        return {}


def find_named(items: list[dict[str, Any]], name: str) -> dict[str, Any]:
    for item in items:
        if item.get("name") == name:
            return item
    return {}


def write_b64_file(directory: Path, filename: str, value: str) -> str:
    path = directory / filename
    path.write_bytes(base64.b64decode(value))
    return str(path)


@app.post("/cluster/validate")
async def validate_cluster(request: ClusterValidationRequest):
    access_token = request.accessToken

    async with httpx.AsyncClient(timeout=20.0) as client:
        if not access_token:
            if not request.tenantId or not request.clientId or not request.clientSecret:
                raise HTTPException(
                    status_code=400,
                    detail="Either accessToken or tenantId/clientId/clientSecret must be provided."
                )
            token_url = f"https://login.microsoftonline.com/{request.tenantId}/oauth2/v2.0/token"
            token_form = {
                "client_id": request.clientId,
                "client_secret": request.clientSecret,
                "grant_type": "client_credentials",
                "scope": "https://management.azure.com/.default",
            }
            try:
                token_response = await client.post(token_url, data=token_form)
            except httpx.RequestError as exc:
                raise HTTPException(
                    status_code=502,
                    detail=f"Unable to reach Microsoft Entra ID: {exc}",
                ) from exc

            if token_response.status_code >= 400:
                raise HTTPException(
                    status_code=401,
                    detail=azure_error_message(
                        response_payload(token_response),
                        "Microsoft Entra authentication failed. Check Tenant ID, Client ID, and Client Secret.",
                    ),
                )

            access_token = token_response.json().get("access_token")
            if not access_token:
                raise HTTPException(
                    status_code=401,
                    detail="Microsoft Entra authentication did not return an access token.",
                )

        cluster_url = (
            "https://management.azure.com/subscriptions/"
            f"{request.subscriptionId}/resourceGroups/{request.resourceGroup}"
            f"/providers/Microsoft.ContainerService/managedClusters/{request.aksClusterName}"
        )
        params = {"api-version": "2024-09-01"}
        headers = {"Authorization": f"Bearer {access_token}"}

        try:
            cluster_response = await client.get(cluster_url, headers=headers, params=params)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Unable to reach Azure Resource Manager: {exc}",
            ) from exc

    if cluster_response.status_code == 404:
        raise HTTPException(
            status_code=404,
            detail="AKS cluster was not found. Check Subscription ID, Resource Group, and AKS Cluster Name.",
        )

    if cluster_response.status_code == 403:
        raise HTTPException(
            status_code=403,
            detail="Service principal authenticated but does not have permission to read this AKS cluster.",
        )

    if cluster_response.status_code >= 400:
        raise HTTPException(
            status_code=cluster_response.status_code,
            detail=azure_error_message(
                response_payload(cluster_response),
                "Azure rejected the cluster validation request.",
            ),
        )

    cluster = cluster_response.json()
    properties = cluster.get("properties", {})
    fqdn = properties.get("fqdn")

    if fqdn and access_token:
        dynamic_kubeconfig = {
            "apiVersion": "v1",
            "kind": "Config",
            "current-context": "default",
            "contexts": [
                {
                    "context": {
                        "cluster": "default",
                        "user": "default"
                    },
                    "name": "default"
                }
            ],
            "clusters": [
                {
                    "cluster": {
                        "server": f"https://{fqdn}",
                        "insecure-skip-tls-verify": True
                    },
                    "name": "default"
                }
            ],
            "users": [
                {
                    "name": "default",
                    "user": {
                        "token": access_token
                    }
                }
            ]
        }
        try:
            WORKSPACE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
            kubeconfig_path = WORKSPACE_TEMP_DIR / "active_kubeconfig.yaml"
            kubeconfig_path.write_text(yaml.safe_dump(dynamic_kubeconfig), encoding="utf-8")
        except Exception:
            pass

    return {
        "valid": True,
        "message": "Azure authentication succeeded and AKS cluster was found.",
        "cluster": {
            "id": cluster.get("id"),
            "name": cluster.get("name"),
            "location": cluster.get("location"),
            "provisioningState": properties.get("provisioningState"),
            "fqdn": properties.get("fqdn"),
            "kubernetesVersion": properties.get("kubernetesVersion"),
        },
    }


@app.post("/cluster/validate-kubeconfig")
async def validate_kubeconfig(request: KubeconfigValidationRequest):
    try:
        kubeconfig = yaml.safe_load(request.kubeconfig)
    except yaml.YAMLError as exc:
        raise HTTPException(status_code=422, detail=f"Kubeconfig YAML is invalid: {exc}") from exc

    if not isinstance(kubeconfig, dict):
        raise HTTPException(status_code=422, detail="Kubeconfig file is empty or invalid.")

    current_context_name = kubeconfig.get("current-context")
    contexts = kubeconfig.get("contexts") or []
    clusters = kubeconfig.get("clusters") or []
    users = kubeconfig.get("users") or []

    if not current_context_name:
        raise HTTPException(status_code=422, detail="Kubeconfig is missing current-context.")

    context_entry = find_named(contexts, current_context_name)
    context = context_entry.get("context") or {}
    cluster_name = context.get("cluster")
    user_name = context.get("user")

    cluster_entry = find_named(clusters, cluster_name)
    cluster_data = cluster_entry.get("cluster") or {}
    user_entry = find_named(users, user_name)
    user_data = user_entry.get("user") or {}
    server = cluster_data.get("server")

    if not server:
        raise HTTPException(status_code=422, detail="Kubeconfig is missing Kubernetes API server URL.")

    if user_data.get("exec"):
        raise HTTPException(
            status_code=422,
            detail=(
                "This kubeconfig uses an exec login plugin. Export an admin/static kubeconfig, "
                "or use Service Principal validation."
            ),
        )

    headers = {}
    if user_data.get("token"):
        headers["Authorization"] = f"Bearer {user_data['token']}"

    WORKSPACE_TEMP_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(dir=WORKSPACE_TEMP_DIR) as temp_dir:
        temp_path = Path(temp_dir)
        verify: bool | str = True
        cert: str | tuple[str, str] | None = None

        if cluster_data.get("insecure-skip-tls-verify"):
            verify = False
        elif cluster_data.get("certificate-authority-data"):
            verify = write_b64_file(temp_path, "ca.crt", cluster_data["certificate-authority-data"])

        if user_data.get("client-certificate-data") and user_data.get("client-key-data"):
            client_cert = write_b64_file(temp_path, "client.crt", user_data["client-certificate-data"])
            client_key = write_b64_file(temp_path, "client.key", user_data["client-key-data"])
            cert = (client_cert, client_key)

        if not headers and not cert:
            raise HTTPException(
                status_code=422,
                detail="Kubeconfig does not include a static token or client certificate credentials.",
            )

        try:
            async with httpx.AsyncClient(timeout=20.0, verify=verify, cert=cert) as client:
                response = await client.get(f"{server.rstrip('/')}/version", headers=headers)
        except httpx.RequestError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Unable to reach Kubernetes API server from kubeconfig: {exc}",
            ) from exc

    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Kubeconfig credentials were rejected by the Kubernetes API.")

    if response.status_code == 403:
        raise HTTPException(status_code=403, detail="Kubeconfig credentials do not have permission to read cluster version.")

    if response.status_code >= 400:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Kubernetes API validation failed with HTTP {response.status_code}.",
        )

    version = response.json()

    # Save the kubeconfig file to workspace temp directory
    WORKSPACE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
    kubeconfig_path = WORKSPACE_TEMP_DIR / "active_kubeconfig.yaml"
    try:
        kubeconfig_path.write_text(request.kubeconfig, encoding="utf-8")
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to store kubeconfig on backend: {exc}"
        ) from exc

    return {
        "valid": True,
        "message": "Kubeconfig validated and Kubernetes API is reachable.",
        "cluster": {
            "name": cluster_name or current_context_name,
            "server": server,
            "kubernetesVersion": version.get("gitVersion"),
        },
    }


async def proxy_request(service_name: str, port: int, path: str, request: Request):
    host = os.environ.get(f"{service_name.upper().replace('-', '_')}_HOST", service_name)
    url = f"http://{host}:{port}/{service_name}/{path}"
    
    query_params = dict(request.query_params)
    body = await request.body()
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=query_params,
                content=body,
                timeout=15.0
            )
        except (httpx.ConnectError, httpx.ConnectTimeout):
            # Fall back to localhost
            url = f"http://localhost:{port}/{service_name}/{path}"
            resp = await client.request(
                method=request.method,
                url=url,
                headers=headers,
                params=query_params,
                content=body,
                timeout=15.0
            )
            
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers)
    )


@app.api_route("/ingest-service/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_ingest(path: str, request: Request):
    return await proxy_request("ingest-service", 8001, path, request)


@app.api_route("/telemetry-store/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_telemetry(path: str, request: Request):
    return await proxy_request("telemetry-store", 8002, path, request)


@app.api_route("/analysis-service/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_analysis(path: str, request: Request):
    return await proxy_request("analysis-service", 8003, path, request)


@app.api_route("/incidents-service/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_incidents(path: str, request: Request):
    return await proxy_request("incidents-service", 8004, path, request)


@app.api_route("/dependency-service/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_dependency(path: str, request: Request):
    return await proxy_request("dependency-service", 8005, path, request)
#   t r i g g e r   b u i l d  
 