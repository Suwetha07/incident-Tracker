from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

app = FastAPI(title="Analysis Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock databases
rca_db = {
    "inc-001": {
        "incidentId": "inc-001",
        "rootCause": "Unoptimized Auth Token cache queries leading to connection pool exhaustion",
        "confidence": 94.5,
        "explanation": "Immediately following the api-gateway-v2.1.0 release, client request volume triggered high frequency JWT token validations. The auth-service attempted to resolve these via un-indexed SQL lookup queries rather than the Redis token cache, causing thread contention and pool starvation in the auth API.",
        "evidenceRefs": [
            "Log spike: 'ConnectionTimeoutException' at auth-service-df98a-289",
            "Prometheus: http_request_duration_seconds{service='auth-service'} p95 exceeded 2500ms",
            "Deployment event: api-gateway deployment v2.1.0"
        ],
        "aiModel": "GPT-4 (AKS Incident Diagnostics)"
    },
    "inc-002": {
        "incidentId": "inc-002",
        "rootCause": "Misconfigured JVM Heap Limits in payment-service container definition",
        "confidence": 88.0,
        "explanation": "The payment-service container specification specifies a resource memory limit of 512Mi. However, the Java application is configured with -Xmx1g (1 Gigabyte Heap). Upon startup/init processing, the JVM garbage collector and heap allocation exceeded the cgroup limits, causing the Linux kernel to terminate the process with OutOfMemory (OOM) Kill code 137.",
        "evidenceRefs": [
            "K8s pod status: OOMKilled",
            "JVM configuration environment variable: JAVA_OPTS='-Xmx1g -Xms512m'",
            "Pod Resource Definition: resources.limits.memory='512Mi'"
        ],
        "aiModel": "GPT-4 (AKS Incident Diagnostics)"
    }
}

recommendations_db = {
    "inc-001": [
        {
            "id": "rec-001a",
            "title": "Rollback api-gateway to v2.0.9",
            "description": "Revert the gateway deployment to the last stable release while the token validation query is optimized.",
            "type": "rollback",
            "priority": "high",
            "estimatedImpact": "Restores gateway responsiveness instantly and clears the auth-service connection queue."
        },
        {
            "id": "rec-001b",
            "title": "Temporarily increase auth-service replicas",
            "description": "Scale the deployment auth-service from 2 to 5 replicas to absorb high concurrency validations.",
            "type": "scale",
            "priority": "medium",
            "estimatedImpact": "Distributes database load across more pods, reducing overall thread timeouts."
        }
    ],
    "inc-002": [
        {
            "id": "rec-002a",
            "title": "Adjust JVM Heap limits to match pod limits",
            "description": "Modify the JAVA_OPTS env var to use -Xmx384m to give the JVM enough breathing room within the 512Mi limits.",
            "type": "resource",
            "priority": "high",
            "estimatedImpact": "Prevents Java application from triggering container runtime OOM kills during boot."
        },
        {
            "id": "rec-002b",
            "title": "Restart payment-service after updating config",
            "description": "Trigger a rolling restart of payment-service deployment pods to apply the new memory parameters.",
            "type": "restart",
            "priority": "high",
            "estimatedImpact": "Restores transaction processing capability."
        }
    ]
}

knowledge_base_db = [
    {
        "id": "kb-001",
        "title": "Troubleshooting JVM Container OOMKilled issues",
        "type": "runbook",
        "content": "This runbook covers how to identify and resolve OutOfMemory limits mismatch (OOMKilled) in Java-based containers running in AKS. Ensure that JVM heap parameters (-Xmx) do not exceed 75% of the pod memory limits to avoid container termination.",
        "tags": ["java", "oom", "aks", "resourcing"],
        "createdAt": "2026-01-15T09:00:00Z",
        "relatedIncidents": ["inc-002"]
    },
    {
        "id": "kb-002",
        "title": "PostgreSQL Connection Pool Tuning for Microservices",
        "type": "runbook",
        "content": "Guides SREs through increasing pgpool capacities and indexing un-indexed reference tables to avoid thread locks and pool starvation during heavy transaction windows.",
        "tags": ["postgres", "database", "tuning"],
        "createdAt": "2026-02-10T14:30:00Z",
        "relatedIncidents": ["inc-003"]
    }
]


@app.get("/health")
async def health():
    return {"status": "ok"}


import httpx

@app.get("/analysis-service/incidents/{incident_id}/rca", response_model=Dict[str, Any])
async def get_rca(incident_id: str, request: Request):
    prom_url = request.headers.get("X-Prometheus-URL")
    
    # Fetch the real incident details from incidents-service
    incident = None
    try:
        headers = {}
        if prom_url:
            headers["X-Prometheus-URL"] = prom_url
        async with httpx.AsyncClient(timeout=5.0) as client:
            # We are inside docker network, we can hit the incidents-service container directly
            res = await client.get(f"http://incidents-service:8004/incidents-service/incidents", headers=headers)
            if res.status_code == 200:
                incidents = res.json()
                for inc in incidents:
                    if inc.get("id") == incident_id:
                        incident = inc
                        break
    except Exception as e:
        print(f"Failed to fetch incident from incidents-service: {e}")
        pass
        
    pod_context = ""
    if incident:
        desc = incident.get("description", "")
        service = incident.get("service", "")
        pod_context = f" Based on the telemetry, the exact component affected is {service}. Details: {desc}."

    if incident_id.startswith("inc-k8s-"):
        return {
            "incidentId": incident_id,
            "rootCause": f"Container crash or initialization failure in {incident.get('service', 'the workload') if incident else 'the workload'}",
            "confidence": 95.0,
            "explanation": f"The target Kubernetes pod entered a non-running or unscheduled phase.{pod_context} This generally occurs when liveness/readiness probes repeatedly fail, required secrets/configmaps are missing, or the containerized process encounters an unhandled runtime error during boot.",
            "evidenceRefs": [
                "Kubernetes API: pod phase status set to non-Running",
                "Kubelet logs: container check failed or was terminated",
                f"Incident Context: {incident.get('title', 'Unknown Title') if incident else 'None'}"
            ],
            "aiModel": "Antigravity Dynamic Diagnostics Agent"
        }
        
    if incident_id.startswith("inc-restart-"):
        return {
            "incidentId": incident_id,
            "rootCause": f"Transient process restarts or CrashLoopBackOff in {incident.get('service', 'the service') if incident else 'the service'}",
            "confidence": 88.0,
            "explanation": f"The pod is restarting repeatedly.{pod_context} This pattern points to thread starvation, JVM OutOfMemory (OOM) code 137, transient external API gateway timeouts, or misconfigured database connection pool caps.",
            "evidenceRefs": [
                "Kubernetes API: container restartCount spiked above threshold",
                "Node Event: container terminated with exit status code 137",
                f"Incident Context: {incident.get('title', 'Unknown Title') if incident else 'None'}"
            ],
            "aiModel": "Antigravity Dynamic Diagnostics Agent"
        }

    if incident_id.startswith("alt-prom-"):
        return {
            "incidentId": incident_id,
            "rootCause": f"Prometheus Alert Triggered: {incident.get('title', 'Alert') if incident else 'Alert'}",
            "confidence": 92.0,
            "explanation": f"Prometheus alert manager fired an alert condition.{pod_context} Review the Prometheus queries to understand the metric threshold violation.",
            "evidenceRefs": [
                "Prometheus AlertManager: Active firing alert rule",
                f"Incident Context: {incident.get('title', 'Unknown Title') if incident else 'None'}"
            ],
            "aiModel": "Antigravity Dynamic Diagnostics Agent"
        }

    if incident_id not in rca_db:
        raise HTTPException(status_code=404, detail="No RCA data for this incident")
    return rca_db[incident_id]


from pydantic import BaseModel

class ChatRequest(BaseModel):
    message: str
    cluster_name: Optional[str] = None

@app.post("/analysis-service/chat")
async def chat(request: ChatRequest):
    message = request.message.lower()
    if "deployment" in message:
        response = "Based on recent cluster metrics, there are several deployments that may be causing issues. Have you checked the latest rollout of your active services?"
    elif "incident" in message:
        response = "I can analyze your active incidents. If you see high CPU or Memory usage, please navigate to the Incident Details page to generate a specific RCA."
    elif "prometheus" in message:
        response = "Prometheus is configured and feeding data into the backend. Alert rules are evaluated every minute to generate incidents."
    else:
        response = f"I am analyzing the {request.cluster_name or 'cluster'} topology. I can see the data flowing from Kubernetes and Prometheus. What specific service would you like me to look into?"
    return {"reply": response}

@app.get("/analysis-service/incidents/{incident_id}/recommendations", response_model=List[Dict[str, Any]])
async def get_recommendations(incident_id: str):
    if incident_id.startswith("inc-k8s-"):
        return [
            {
                "id": f"rec-{incident_id}-1",
                "title": "Check Pod Logs & Description",
                "description": "Run 'kubectl logs' and 'kubectl describe pod' to inspect stderr outputs, termination messages, or mount errors.",
                "type": "resource",
                "priority": "high",
                "estimatedImpact": "Identifies the exact runtime exception or configuration issue causing startup failure."
            },
            {
                "id": f"rec-{incident_id}-2",
                "title": "Verify ConfigMaps and Secrets",
                "description": "Ensure all env variables, configurations, and vault credentials referenced by the container specification exist and are correctly structured.",
                "type": "restart",
                "priority": "medium",
                "estimatedImpact": "Resolves dependency loading errors."
            }
        ]
        
    if incident_id.startswith("inc-restart-"):
        return [
            {
                "id": f"rec-{incident_id}-1",
                "title": "Profile memory usage and limits",
                "description": "Analyze heap memory and container limits. Check if the restart is due to OOM kills (Exit code 137).",
                "type": "resource",
                "priority": "high",
                "estimatedImpact": "Prevents container runtime environment from terminating the JVM/Node process."
            },
            {
                "id": f"rec-{incident_id}-2",
                "title": "Configure Liveness/Readiness probes thresholds",
                "description": "Increase initialDelaySeconds or failureThreshold to allow slow starting backend services to complete initialization before being restarted.",
                "type": "restart",
                "priority": "medium",
                "estimatedImpact": "Mitigates startup-loop restarts."
            }
        ]

    return recommendations_db.get(incident_id, [])


@app.get("/analysis-service/knowledge-base", response_model=List[Dict[str, Any]])
async def get_knowledge_base(q: Optional[str] = None):
    if not q:
        return knowledge_base_db
    query = q.lower()
    return [
        item for item in knowledge_base_db 
        if query in item["title"].lower() or any(query in tag.lower() for tag in item["tags"])
    ]
