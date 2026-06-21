import base64
import os
import tempfile
import yaml
from pathlib import Path
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

app = FastAPI(title="Ingest Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock deployments fallback database
deployments_db = [
    {
        "id": "dep-001",
        "service": "api-gateway",
        "version": "v2.1.0",
        "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z",
        "successRate": 91.6,
        "riskScore": 85,
        "status": "failed",
        "affectedServices": ["auth-service", "frontend"]
    },
    {
        "id": "dep-002",
        "service": "payment-service",
        "version": "v1.4.3",
        "timestamp": (datetime.utcnow() - timedelta(hours=4)).isoformat() + "Z",
        "successRate": 100.0,
        "riskScore": 15,
        "status": "success"
    },
    {
        "id": "dep-003",
        "service": "order-service",
        "version": "v3.0.2",
        "timestamp": (datetime.utcnow() - timedelta(days=2)).isoformat() + "Z",
        "successRate": 99.8,
        "riskScore": 30,
        "status": "success"
    },
    {
        "id": "dep-004",
        "service": "auth-service",
        "version": "v1.2.9",
        "timestamp": (datetime.utcnow() - timedelta(days=5)).isoformat() + "Z",
        "successRate": 65.4,
        "riskScore": 90,
        "status": "rollback",
        "affectedServices": ["api-gateway"]
    }
]

WORKSPACE_TEMP_DIR = Path(__file__).resolve().parents[1] / ".backend-logs" / "tmp"

def find_named(items: list, name: str) -> dict:
    for item in items:
        if item.get("name") == name:
            return item
    return {}

async def fetch_k8s_deployments() -> List[Dict[str, Any]]:
    kubeconfig_path = WORKSPACE_TEMP_DIR / "active_kubeconfig.yaml"
    if not kubeconfig_path.exists():
        return []

    try:
        content = kubeconfig_path.read_text(encoding="utf-8")
        kubeconfig = yaml.safe_load(content)
    except Exception:
        return []

    if not isinstance(kubeconfig, dict):
        return []

    current_context = kubeconfig.get("current-context")
    contexts = kubeconfig.get("contexts") or []
    clusters = kubeconfig.get("clusters") or []
    users = kubeconfig.get("users") or []

    if not current_context:
        return []

    context_entry = find_named(contexts, current_context)
    context = context_entry.get("context") or {}
    cluster_name = context.get("cluster")
    user_name = context.get("user")

    cluster_entry = find_named(clusters, cluster_name)
    cluster_data = cluster_entry.get("cluster") or {}
    user_entry = find_named(users, user_name)
    user_data = user_entry.get("user") or {}
    server = cluster_data.get("server")

    if not server:
        return []

    headers = {}
    if user_data.get("token"):
        headers["Authorization"] = f"Bearer {user_data['token']}"

    verify = False

    with tempfile.TemporaryDirectory(dir=WORKSPACE_TEMP_DIR) as temp_dir:
        temp_path = Path(temp_dir)
        cert = None
        
        if user_data.get("client-certificate-data") and user_data.get("client-key-data"):
            cert_path = temp_path / "client.crt"
            key_path = temp_path / "client.key"
            cert_path.write_bytes(base64.b64decode(user_data["client-certificate-data"]))
            key_path.write_bytes(base64.b64decode(user_data["client-key-data"]))
            cert = (str(cert_path), str(key_path))

        try:
            async with httpx.AsyncClient(timeout=5.0, verify=verify, cert=cert) as client:
                res = await client.get(f"{server.rstrip('/')}/apis/apps/v1/deployments", headers=headers)
                if res.status_code == 200:
                    deployments = []
                    for item in res.json().get("items", []):
                        metadata = item.get("metadata") or {}
                        spec = item.get("spec") or {}
                        status_info = item.get("status") or {}
                        
                        name = metadata.get("name")
                        replicas = spec.get("replicas", 1)
                        ready_replicas = status_info.get("readyReplicas", 0)
                        
                        status = "success"
                        success_rate = 100.0
                        risk_score = 10
                        if ready_replicas < replicas:
                            status = "failed"
                            success_rate = round((ready_replicas / replicas) * 100, 1) if replicas > 0 else 0.0
                            risk_score = 80
                            
                        containers = spec.get("template", {}).get("spec", {}).get("containers", [])
                        version = "latest"
                        if containers:
                            image = containers[0].get("image", "")
                            if ":" in image:
                                version = image.split(":")[-1]
                                
                        deployments.append({
                            "id": f"dep-{name}",
                            "service": name,
                            "version": version,
                            "timestamp": metadata.get("creationTimestamp") or datetime.utcnow().isoformat() + "Z",
                            "successRate": success_rate,
                            "riskScore": risk_score,
                            "status": status,
                            "affectedServices": []
                        })
                    return deployments
                else:
                    print(f"K8s query failed with {res.status_code}: {res.text}")
        except Exception as e:
            print(f"K8s query error: {e}")
            pass
    return []


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ingest-service/deployments", response_model=List[Dict[str, Any]])
async def get_deployments(request: Request):
    k8s_deps = await fetch_k8s_deployments()
    if not k8s_deps:
        return deployments_db
    return k8s_deps
