import base64
import os
import tempfile
import yaml
from pathlib import Path
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

async def get_prometheus_headers(prometheus_url: str) -> dict:
    headers = {}
    if prometheus_url and "monitor.azure.com" in prometheus_url:
        try:
            from azure.identity.aio import DefaultAzureCredential
            credential = DefaultAzureCredential()
            token = await credential.get_token("https://prometheus.monitor.azure.com/.default")
            headers["Authorization"] = f"Bearer {token.token}"
            print("Successfully obtained Azure AD token via Workload Identity!")
            await credential.close()
        except Exception as e:
            print(f"Failed to get Azure AD token via Workload Identity: {e}")
    return headers

app = FastAPI(title="Dependency Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def extract_kubeconfig(request: Request, call_next):
    kubeconfig_header = request.headers.get("X-Kubeconfig")
    if kubeconfig_header:
        try:
            import base64
            from pathlib import Path
            WORKSPACE_TEMP_DIR = Path(__file__).resolve().parents[1] / ".backend-logs" / "tmp"
            WORKSPACE_TEMP_DIR.mkdir(parents=True, exist_ok=True)
            kubeconfig_path = WORKSPACE_TEMP_DIR / "active_kubeconfig.yaml"
            try:
                decoded = base64.b64decode(kubeconfig_header).decode("utf-8")
                if "apiVersion" in decoded:
                    kubeconfig_path.write_text(decoded, encoding="utf-8")
            except Exception:
                if "apiVersion" in kubeconfig_header:
                    kubeconfig_path.write_text(kubeconfig_header, encoding="utf-8")
        except Exception:
            pass
    response = await call_next(request)
    return response

# Fallback databases
services_db = [
    {
        "id": "svc-frontend-ui",
        "name": "frontend-ui",
        "namespace": "dev",
        "owner": "Web Team",
        "status": "healthy",
        "replicas": 2,
        "cpuUsage": 12,
        "memoryUsage": 25
    },
    {
        "id": "svc-api-gateway",
        "name": "api-gateway",
        "namespace": "dev",
        "owner": "Platform Team",
        "status": "healthy",
        "replicas": 2,
        "cpuUsage": 18,
        "memoryUsage": 32
    },
    {
        "id": "svc-incident-tracker-gateway",
        "name": "incident-tracker-gateway",
        "namespace": "dev",
        "owner": "Platform Team",
        "status": "healthy",
        "replicas": 1,
        "cpuUsage": 5,
        "memoryUsage": 15
    },
    {
        "id": "svc-telemetry-store",
        "name": "telemetry-store",
        "namespace": "dev",
        "owner": "Telemetry Team",
        "status": "healthy",
        "replicas": 2,
        "cpuUsage": 14,
        "memoryUsage": 28
    },
    {
        "id": "svc-incidents-service",
        "name": "incidents-service",
        "namespace": "dev",
        "owner": "Alerts Team",
        "status": "healthy",
        "replicas": 2,
        "cpuUsage": 20,
        "memoryUsage": 35
    },
    {
        "id": "svc-dependency-service",
        "name": "dependency-service",
        "namespace": "dev",
        "owner": "Platform Team",
        "status": "healthy",
        "replicas": 2,
        "cpuUsage": 10,
        "memoryUsage": 22
    },
    {
        "id": "svc-ingest-service",
        "name": "ingest-service",
        "namespace": "dev",
        "owner": "Ingest Team",
        "status": "healthy",
        "replicas": 2,
        "cpuUsage": 15,
        "memoryUsage": 30
    },
    {
        "id": "svc-analysis-service",
        "name": "analysis-service",
        "namespace": "dev",
        "owner": "AI Team",
        "status": "healthy",
        "replicas": 2,
        "cpuUsage": 25,
        "memoryUsage": 45
    },
    {
        "id": "svc-redis",
        "name": "redis",
        "namespace": "dev",
        "owner": "Infra Team",
        "status": "healthy",
        "replicas": 1,
        "cpuUsage": 8,
        "memoryUsage": 12
    }
]

dependencies_db = [
    {"from": "frontend-ui", "to": "incident-tracker-gateway", "type": "http", "confidence": 100, "latency": 45},
    {"from": "incident-tracker-gateway", "to": "api-gateway", "type": "http", "confidence": 100, "latency": 30},
    {"from": "api-gateway", "to": "telemetry-store", "type": "http", "confidence": 100, "latency": 80},
    {"from": "api-gateway", "to": "incidents-service", "type": "http", "confidence": 100, "latency": 75},
    {"from": "api-gateway", "to": "dependency-service", "type": "http", "confidence": 100, "latency": 60},
    {"from": "api-gateway", "to": "ingest-service", "type": "http", "confidence": 100, "latency": 90},
    {"from": "api-gateway", "to": "analysis-service", "type": "http", "confidence": 100, "latency": 150},
    {"from": "incidents-service", "to": "redis", "type": "tcp", "confidence": 100, "latency": 5},
    {"from": "telemetry-store", "to": "redis", "type": "tcp", "confidence": 100, "latency": 5}
]

WORKSPACE_TEMP_DIR = Path(__file__).resolve().parents[1] / ".backend-logs" / "tmp"

def find_named(items: list, name: str) -> dict:
    for item in items:
        if item.get("name") == name:
            return item
    return {}

async def fetch_k8s_services_and_pods():
    # 1. Try to load from active_kubeconfig.yaml
    kubeconfig_path = WORKSPACE_TEMP_DIR / "active_kubeconfig.yaml"
    kubeconfig = None
    if kubeconfig_path.exists():
        try:
            content = kubeconfig_path.read_text(encoding="utf-8")
            kubeconfig = yaml.safe_load(content)
        except Exception:
            pass

    server = None
    headers = {}
    verify = False
    cert = None

    if isinstance(kubeconfig, dict):
        current_context = kubeconfig.get("current-context")
        contexts = kubeconfig.get("contexts") or []
        clusters = kubeconfig.get("clusters") or []
        users = kubeconfig.get("users") or []

        if current_context:
            context_entry = find_named(contexts, current_context)
            context = context_entry.get("context") or {}
            cluster_name = context.get("cluster")
            user_name = context.get("user")

            cluster_entry = find_named(clusters, cluster_name)
            cluster_data = cluster_entry.get("cluster") or {}
            user_entry = find_named(users, user_name)
            user_data = user_entry.get("user") or {}
            server = cluster_data.get("server")

            if server:
                if user_data.get("token"):
                    headers["Authorization"] = f"Bearer {user_data['token']}"

    # 2. In-cluster fallback
    if not server:
        token_path = Path("/var/run/secrets/kubernetes.io/serviceaccount/token")
        ca_path = Path("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt")
        if token_path.exists():
            try:
                server = "https://kubernetes.default.svc"
                token = token_path.read_text(encoding="utf-8").strip()
                headers["Authorization"] = f"Bearer {token}"
                verify = str(ca_path) if ca_path.exists() else False
            except Exception:
                pass

    if not server:
        return [], []

    with tempfile.TemporaryDirectory(dir=WORKSPACE_TEMP_DIR) as temp_dir:
        temp_path = Path(temp_dir)
        
        if kubeconfig and isinstance(kubeconfig, dict):
            current_context = kubeconfig.get("current-context")
            contexts = kubeconfig.get("contexts") or []
            context_entry = find_named(contexts, current_context)
            context = context_entry.get("context") or {}
            cluster_name = context.get("cluster")
            user_name = context.get("user")
            
            clusters = kubeconfig.get("clusters") or []
            cluster_entry = find_named(clusters, cluster_name)
            cluster_data = cluster_entry.get("cluster") or {}
            
            users = kubeconfig.get("users") or []
            user_entry = find_named(users, user_name)
            user_data = user_entry.get("user") or {}
            
            if user_data.get("client-certificate-data") and user_data.get("client-key-data"):
                cert_path = temp_path / "client.crt"
                key_path = temp_path / "client.key"
                cert_path.write_bytes(base64.b64decode(user_data["client-certificate-data"]))
                key_path.write_bytes(base64.b64decode(user_data["client-key-data"]))
                cert = (str(cert_path), str(key_path))
                
            if cluster_data.get("insecure-skip-tls-verify"):
                verify = False
            elif cluster_data.get("certificate-authority-data"):
                verify_path = temp_path / "ca.crt"
                verify_path.write_bytes(base64.b64decode(cluster_data["certificate-authority-data"]))
                verify = str(verify_path)

        try:
            async with httpx.AsyncClient(timeout=5.0, verify=verify, cert=cert) as client:
                services_res = await client.get(f"{server.rstrip('/')}/api/v1/namespaces/dev/services", headers=headers)
                pods_res = await client.get(f"{server.rstrip('/')}/api/v1/namespaces/dev/pods", headers=headers)
                
                services = services_res.json().get("items", []) if services_res.status_code == 200 else []
                pods = pods_res.json().get("items", []) if pods_res.status_code == 200 else []
                return services, pods
        except Exception as e:
            print(f"K8s query error: {e}")
            pass
    return [], []

async def get_dynamic_dependency_data(prometheus_url: Optional[str] = None):
    services, pods = await fetch_k8s_services_and_pods()
    
    if not services:
        return services_db, dependencies_db
        
    dynamic_services = []
    
    for idx, svc in enumerate(services):
        metadata = svc.get("metadata") or {}
        spec = svc.get("spec") or {}
        name = metadata.get("name")
        namespace = metadata.get("namespace")
        
        matching_pods = [p for p in pods if name in p.get("metadata", {}).get("name", "")]
        replicas = len(matching_pods) if matching_pods else 1
        
        status = "healthy"
        cpu = 15
        mem = 30
        for p in matching_pods:
            p_status = p.get("status", "Unknown")
            if p_status not in ("Running", "Succeeded"):
                status = "critical" if p_status == "Failed" else "degraded"
                cpu = 90
                mem = 95
                
        # Prometheus Query
        if prometheus_url:
            prom_headers = await get_prometheus_headers(prometheus_url)
            try:
                async with httpx.AsyncClient(timeout=2.0) as client:
                    # Query average CPU usage rate
                    q_cpu = f'sum(rate(container_cpu_usage_seconds_total{{namespace="{namespace}", pod=~"{name}.*"}}[2m])) * 100'
                    resp = await client.get(f"{prometheus_url.rstrip('/')}/api/v1/query", params={"query": q_cpu}, headers=prom_headers)
                    if resp.status_code == 200:
                        result = resp.json().get("data", {}).get("result", [])
                        if result:
                            cpu = min(100, int(float(result[0]["value"][1])))
                            
                    # Query average Memory usage percentage
                    q_mem = f'sum(container_memory_working_set_bytes{{namespace="{namespace}", pod=~"{name}.*"}}) / sum(kube_pod_container_resource_limits{{resource="memory", namespace="{namespace}", pod=~"{name}.*"}}) * 100'
                    resp = await client.get(f"{prometheus_url.rstrip('/')}/api/v1/query", params={"query": q_mem}, headers=prom_headers)
                    if resp.status_code == 200:
                        result = resp.json().get("data", {}).get("result", [])
                        if result:
                            mem = min(100, int(float(result[0]["value"][1])))
            except Exception:
                pass
                
        dynamic_services.append({
            "id": f"svc-{name}",
            "name": name,
            "namespace": namespace,
            "owner": "App Dev Team" if namespace == "default" else "Kubernetes System",
            "status": status,
            "replicas": replicas,
            "cpuUsage": cpu,
            "memoryUsage": mem
        })
        
    dynamic_dependencies = []
    service_names = [s["name"] for s in dynamic_services]
    
    gateways = [n for n in service_names if "gateway" in n or "ingress" in n or "frontend" in n]
    dbs = [n for n in service_names if "db" in n or "postgres" in n or "redis" in n or "mongo" in n or "sql" in n]
    apps = [n for n in service_names if n not in gateways and n not in dbs and n != "kubernetes"]
    
    for gw in gateways:
        for app in apps[:3]:
            dynamic_dependencies.append({
                "from": gw,
                "to": app,
                "type": "http",
                "confidence": 100,
                "latency": 120
            })
            
    for app in apps:
        for db in dbs:
            dynamic_dependencies.append({
                "from": app,
                "to": db,
                "type": "database",
                "confidence": 100,
                "latency": 15
            })
            
    if not dynamic_dependencies and len(service_names) >= 2:
        dynamic_dependencies.append({
            "from": service_names[0],
            "to": service_names[1],
            "type": "http",
            "confidence": 100,
            "latency": 50
        })
        
    return dynamic_services, dynamic_dependencies


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/dependency-service/services", response_model=List[Dict[str, Any]])
async def get_services(request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    services, _ = await get_dynamic_dependency_data(prom_url)
    return services


@app.get("/dependency-service/services/{service_id}/dependencies", response_model=List[Dict[str, Any]])
async def get_service_dependencies(service_id: str, request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    services, dependencies = await get_dynamic_dependency_data(prom_url)
    
    svc_name = None
    for s in services:
        if s["id"] == service_id or s["name"] == service_id:
            svc_name = s["name"]
            break
            
    if not svc_name:
        raise HTTPException(status_code=404, detail="Service not found")
        
    return [d for d in dependencies if d["from"] == svc_name or d["to"] == svc_name]


@app.get("/dependency-service/graph", response_model=Dict[str, Any])
async def get_graph(request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    services, dependencies = await get_dynamic_dependency_data(prom_url)
    return {
        "services": services,
        "dependencies": dependencies
    }
