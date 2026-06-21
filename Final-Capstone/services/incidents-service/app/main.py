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

app = FastAPI(title="Incidents Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock databases fallback
incidents_db = [
    {
        "id": "inc-001",
        "title": "API Gateway High Latency Spikes",
        "description": "API Gateway is exhibiting elevated 95th-percentile response latency (>2000ms) leading to transient client-side read timeouts.",
        "severity": "critical",
        "status": "investigating",
        "service": "api-gateway",
        "aiConfidence": 94.5,
        "assignedEngineer": "SRE On-Call",
        "createdAt": (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z",
        "blastRadius": ["api-gateway", "auth-service", "frontend"],
        "rootCause": "Unoptimized token validation queries in auth cache database following v2.1.0 gateway deployment."
    },
    {
        "id": "inc-002",
        "title": "Payment Service Pod CrashLoopBackOff",
        "description": "Payment processor service pods are crashing repeatedly on startup due to OutOfMemory (OOM) kills during init container execution.",
        "severity": "critical",
        "status": "open",
        "service": "payment-service",
        "aiConfidence": 88.0,
        "assignedEngineer": "DevOps Lead",
        "createdAt": (datetime.utcnow() - timedelta(minutes=45)).isoformat() + "Z",
        "blastRadius": ["payment-service", "order-service"],
        "rootCause": "Payment SDK JVM heap memory size configured higher than the Kubernetes pod spec memory limits."
    },
    {
        "id": "inc-003",
        "title": "Order DB Connection Pool Exhaustion",
        "description": "The relational database connection pool for order-service has reached maximum capacity, dropping non-critical read queries.",
        "severity": "warning",
        "status": "resolved",
        "service": "order-db",
        "aiConfidence": 91.2,
        "assignedEngineer": "DBA Team",
        "createdAt": (datetime.utcnow() - timedelta(hours=6)).isoformat() + "Z",
        "resolvedAt": (datetime.utcnow() - timedelta(hours=5)).isoformat() + "Z",
        "blastRadius": ["order-service", "order-db"],
        "rootCause": "Unindexed transaction queries resulting in locked database rows and prolonged execution times."
    },
    {
        "id": "inc-004",
        "title": "Auth Token Verification Timeouts",
        "description": "Transient timeouts observed during Microsoft Entra OAuth token validations from external user connections.",
        "severity": "info",
        "status": "closed",
        "service": "auth-service",
        "aiConfidence": 79.4,
        "assignedEngineer": "Identity SRE",
        "createdAt": (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z",
        "resolvedAt": (datetime.utcnow() - timedelta(days=1, hours=23)).isoformat() + "Z",
        "blastRadius": ["auth-service"],
        "rootCause": "Temporary degradation in Microsoft Entra token endpoint availability."
    }
]

alerts_db = [
    {
        "id": "alt-001",
        "severity": "critical",
        "title": "PodMemoryUsageThresholdExceeded",
        "service": "payment-service",
        "source": "Prometheus Rules",
        "timestamp": (datetime.utcnow() - timedelta(minutes=40)).isoformat() + "Z",
        "status": "triggered"
    },
    {
        "id": "alt-002",
        "severity": "warning",
        "title": "Http5xxErrorRateHigh",
        "service": "api-gateway",
        "source": "Prometheus Rules",
        "timestamp": (datetime.utcnow() - timedelta(hours=1, minutes=50)).isoformat() + "Z",
        "status": "acknowledged"
    },
    {
        "id": "alt-003",
        "severity": "info",
        "title": "DiskSpaceRunningLow",
        "service": "auth-service",
        "source": "Prometheus Rules",
        "timestamp": (datetime.utcnow() - timedelta(hours=22)).isoformat() + "Z",
        "status": "resolved"
    }
]

timeline_db = {
    "inc-001": [
        {
            "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z",
            "event": "Deployment of api-gateway-v2.1.0 initiated by CI/CD pipeline",
            "service": "api-gateway",
            "severity": "info",
            "details": {"version": "v2.1.0", "trigger": "Gitlab-CI"}
        },
        {
            "timestamp": (datetime.utcnow() - timedelta(hours=1, minutes=55)).isoformat() + "Z",
            "event": "Elevated latency detected on HTTP GET /auth/verify endpoint",
            "service": "auth-service",
            "severity": "warning",
            "details": {"latency_p95_ms": 1250, "threshold_ms": 500}
        },
        {
            "timestamp": (datetime.utcnow() - timedelta(hours=1, minutes=50)).isoformat() + "Z",
            "event": "HTTP 502/504 error count spiked to 8% at ApiGateway level",
            "service": "api-gateway",
            "severity": "critical",
            "details": {"error_percentage": 8.4}
        },
        {
            "timestamp": (datetime.utcnow() - timedelta(hours=1, minutes=45)).isoformat() + "Z",
            "event": "Incident ticket automatically created by Incident Tracker SRE Agent",
            "service": "api-gateway",
            "severity": "info",
            "details": {"ticket_id": "inc-001"}
        }
    ],
    "inc-002": [
        {
            "timestamp": (datetime.utcnow() - timedelta(minutes=50)).isoformat() + "Z",
            "event": "HPA scaled deployment 'payment-service' from 2 to 4 replicas",
            "service": "payment-service",
            "severity": "info"
        },
        {
            "timestamp": (datetime.utcnow() - timedelta(minutes=45)).isoformat() + "Z",
            "event": "Pod payment-service-df9a28c-9a81 crashed with status OOMKilled",
            "service": "payment-service",
            "severity": "critical"
        },
        {
            "timestamp": (datetime.utcnow() - timedelta(minutes=40)).isoformat() + "Z",
            "event": "Alert PodMemoryUsageThresholdExceeded triggered",
            "service": "payment-service",
            "severity": "critical"
        }
    ],
    "inc-003": [
        {
            "timestamp": (datetime.utcnow() - timedelta(hours=6)).isoformat() + "Z",
            "event": "Database connection count reached pool limit (100)",
            "service": "order-db",
            "severity": "critical"
        },
        {
            "timestamp": (datetime.utcnow() - timedelta(hours=5, minutes=30)).isoformat() + "Z",
            "event": "Kill slow-running postgres lock query processes",
            "service": "order-db",
            "severity": "info"
        },
        {
            "timestamp": (datetime.utcnow() - timedelta(hours=5)).isoformat() + "Z",
            "event": "Database connection pool usage dropped below 40%",
            "service": "order-db",
            "severity": "info"
        }
    ],
    "inc-004": [
        {
            "timestamp": (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z",
            "event": "Entra ID authorization timeouts reported",
            "service": "auth-service",
            "severity": "warning"
        },
        {
            "timestamp": (datetime.utcnow() - timedelta(days=1, hours=23)).isoformat() + "Z",
            "event": "Microsoft cloud region health restored; Entra service operational",
            "service": "auth-service",
            "severity": "info"
        }
    ]
}

WORKSPACE_TEMP_DIR = Path(__file__).resolve().parents[1] / ".backend-logs" / "tmp"

def find_named(items: list, name: str) -> dict:
    for item in items:
        if item.get("name") == name:
            return item
    return {}

async def get_live_pods() -> List[Dict[str, Any]]:
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
                res = await client.get(f"{server.rstrip('/')}/api/v1/pods", headers=headers)
                if res.status_code == 200:
                    pods = []
                    for item in res.json().get("items", []):
                        metadata = item.get("metadata") or {}
                        status_info = item.get("status") or {}
                        spec = item.get("spec") or {}
                        
                        restart_count = 0
                        for c_status in status_info.get("containerStatuses", []):
                            restart_count += c_status.get("restartCount", 0)
                            
                        pods.append({
                            "name": metadata.get("name"),
                            "namespace": metadata.get("namespace"),
                            "status": status_info.get("phase", "Unknown"),
                            "restartCount": restart_count,
                            "nodeName": spec.get("nodeName")
                        })
                    return pods
        except Exception as e:
            print(f"K8s query error: {e}")
            pass
    return []

async def get_dynamic_incidents_alerts_timeline(prometheus_url: Optional[str] = None):
    pods = await get_live_pods()
    
    # 1. Fetch Prometheus active alerts if Prometheus URL is supplied
    prom_alerts = []
    if prometheus_url:
        prom_headers = await get_prometheus_headers(prometheus_url)
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{prometheus_url.rstrip('/')}/api/v1/alerts", headers=prom_headers)
                if res.status_code == 200:
                    data = res.json().get("data", {})
                    for alert in data.get("alerts", []):
                        labels = alert.get("labels", {})
                        annotations = alert.get("annotations", {})
                        prom_alerts.append({
                            "id": f"alt-prom-{labels.get('alertname')}-{len(prom_alerts)}",
                            "severity": labels.get("severity", "warning"),
                            "title": labels.get("alertname", "AlertTriggered"),
                            "service": labels.get("service") or labels.get("kubernetes_name") or "cluster-service",
                            "source": "Prometheus",
                            "timestamp": alert.get("activeAt") or datetime.utcnow().isoformat() + "Z",
                            "status": alert.get("state", "firing")
                        })
        except Exception:
            pass

    if not pods:
        # If offline, return mock baseline + any prom alerts
        all_alerts = list(alerts_db)
        if prom_alerts:
            all_alerts.extend(prom_alerts)
        return incidents_db, all_alerts, timeline_db

    dynamic_incidents = []
    dynamic_alerts = []
    dynamic_timeline = {}

    failing_pods = [p for p in pods if p["status"] not in ("Running", "Succeeded")]
    restarting_pods = [p for p in pods if p["restartCount"] > 0 and p not in failing_pods]

    # Generate incidents for failing pods
    for idx, p in enumerate(failing_pods):
        inc_id = f"inc-k8s-{idx:03d}"
        pod_name = p["name"]
        namespace = p["namespace"]
        status = p["status"]
        
        parts = pod_name.split("-")
        service_name = "-".join(parts[:-2]) if len(parts) > 2 else pod_name
        
        title = f"Pod {pod_name} in {status} State"
        description = f"Kubernetes pod {pod_name} in namespace {namespace} is currently in {status} state on node {p.get('nodeName') or 'Unscheduled'}."
        
        timeline_events = [
            {
                "timestamp": (datetime.utcnow() - timedelta(minutes=30)).isoformat() + "Z",
                "event": f"Pod {pod_name} initialization requested",
                "service": service_name,
                "severity": "info"
            },
            {
                "timestamp": (datetime.utcnow() - timedelta(minutes=25)).isoformat() + "Z",
                "event": f"Pod container failed to transition to Ready: status={status}",
                "service": service_name,
                "severity": "critical"
            }
        ]
        
        alert_id = f"alt-k8s-{idx:03d}"
        dynamic_alerts.append({
            "id": alert_id,
            "severity": "critical",
            "title": f"PodFailedState",
            "service": service_name,
            "source": "Kubernetes API",
            "timestamp": (datetime.utcnow() - timedelta(minutes=25)).isoformat() + "Z",
            "status": "triggered"
        })
        
        dynamic_incidents.append({
            "id": inc_id,
            "title": title,
            "description": description,
            "severity": "critical",
            "status": "investigating" if idx == 0 else "open",
            "service": service_name,
            "aiConfidence": 95.0,
            "assignedEngineer": "SRE On-Call",
            "createdAt": (datetime.utcnow() - timedelta(minutes=25)).isoformat() + "Z",
            "blastRadius": [service_name, "kube-system"] if namespace != "default" else [service_name],
            "rootCause": f"Pod initialization failed. Kubernetes lifecycle phase reports: {status}."
        })
        dynamic_timeline[inc_id] = timeline_events

    # Generate incidents for restarting pods
    for idx, p in enumerate(restarting_pods):
        inc_id = f"inc-restart-{idx:03d}"
        pod_name = p["name"]
        namespace = p["namespace"]
        restarts = p["restartCount"]
        
        parts = pod_name.split("-")
        service_name = "-".join(parts[:-2]) if len(parts) > 2 else pod_name
        
        title = f"High Restart Count on Pod {pod_name}"
        description = f"Kubernetes pod {pod_name} in namespace {namespace} has restarted {restarts} times. This indicates potential resource leaks or network timeout thresholds."
        
        timeline_events = [
            {
                "timestamp": (datetime.utcnow() - timedelta(hours=1)).isoformat() + "Z",
                "event": f"Container restart cycle started on pod {pod_name}",
                "service": service_name,
                "severity": "warning"
            },
            {
                "timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat() + "Z",
                "event": f"Pod restart count crossed threshold. Restarts: {restarts}",
                "service": service_name,
                "severity": "warning"
            }
        ]
        
        alert_id = f"alt-restart-{idx:03d}"
        dynamic_alerts.append({
            "id": alert_id,
            "severity": "warning",
            "title": "PodRestartThresholdExceeded",
            "service": service_name,
            "source": "Kubernetes API",
            "timestamp": (datetime.utcnow() - timedelta(minutes=5)).isoformat() + "Z",
            "status": "triggered"
        })
        
        dynamic_incidents.append({
            "id": inc_id,
            "title": title,
            "description": description,
            "severity": "warning",
            "status": "open",
            "service": service_name,
            "aiConfidence": 85.0,
            "assignedEngineer": "Platform Engineer",
            "createdAt": (datetime.utcnow() - timedelta(hours=1)).isoformat() + "Z",
            "blastRadius": [service_name],
            "rootCause": f"Container process terminated. Total restarts: {restarts}."
        })
        dynamic_timeline[inc_id] = timeline_events

    # Merge Prometheus alerts
    if prom_alerts:
        dynamic_alerts.extend(prom_alerts)

    # If we have successfully connected to K8s and parsed pods, DO NOT merge the mock database!
    if len(pods) > 0 or len(dynamic_incidents) > 0:
        return dynamic_incidents, dynamic_alerts, dynamic_timeline
        
    all_incidents = dynamic_incidents + incidents_db
    all_alerts = dynamic_alerts + alerts_db
    all_timelines = {**timeline_db, **dynamic_timeline}
    return all_incidents, all_alerts, all_timelines

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/incidents-service/incidents", response_model=List[Dict[str, Any]])
async def get_incidents(request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    incidents, _, _ = await get_dynamic_incidents_alerts_timeline(prom_url)
    return incidents


@app.get("/incidents-service/incidents/{incident_id}", response_model=Dict[str, Any])
async def get_incident(incident_id: str, request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    incidents, _, _ = await get_dynamic_incidents_alerts_timeline(prom_url)
    for inc in incidents:
        if inc["id"] == incident_id:
            return inc
    raise HTTPException(status_code=404, detail="Incident not found")


@app.get("/incidents-service/incidents/{incident_id}/timeline", response_model=List[Dict[str, Any]])
async def get_timeline(incident_id: str, request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    _, _, timelines = await get_dynamic_incidents_alerts_timeline(prom_url)
    return timelines.get(incident_id, [])


@app.get("/incidents-service/kpis", response_model=Dict[str, Any])
async def get_kpis(request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    incidents, _, _ = await get_dynamic_incidents_alerts_timeline(prom_url)
    
    active_count = len([i for i in incidents if i["status"] in ("open", "investigating")])
    critical_count = len([i for i in incidents if i["severity"] == "critical" and i["status"] in ("open", "investigating")])
    
    # Calculate MTTR based on active incidents
    mttd = 4 if active_count > 0 else 0
    mttr = 24 if active_count > 0 else 0
    
    return {
        "activeIncidents": active_count,
        "criticalIncidents": critical_count,
        "clusterHealthScore": 95 if active_count == 0 else max(40, 95 - (active_count * 15)),
        "aiConfidenceAverage": 92 if active_count > 0 else 99,
        "mttr": mttr,
        "mttd": mttd
    }


@app.get("/incidents-service/alerts", response_model=List[Dict[str, Any]])
async def get_alerts(request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    _, alerts, _ = await get_dynamic_incidents_alerts_timeline(prom_url)
    return alerts
