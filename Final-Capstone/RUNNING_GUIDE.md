# Kubernetes Incident Intelligence Engine — Running Guide

Since you do not have Python/pip configured in your Windows system PATH, you can run the **entire application** (React frontend + Postgres + Redis + all microservices) using Docker. This avoids needing to install Python, pip, Node.js, or npm on your local host system!

---

## 🚀 The Easiest Way: Run Everything via Docker Compose (Recommended)

Since the frontend and all microservices are containerized, you can launch everything in one step:

1. Open PowerShell in the project directory:
   ```powershell
   cd C:\Users\Admin\Downloads\incident-Tracker-master\Final-Capstone
   ```

2. Run the single Docker Compose command to build and launch all services:
   ```powershell
   docker-compose up --build
   ```

This command will automatically:
- Download the base Python and Node.js images.
- Build the containers for the **frontend (web-app)** and all **6 microservices**.
- Install all requirements (`pip install` and `npm install` equivalents) inside the Docker containers.
- Create a shared data volume (`tmp-data`) to seamlessly share the uploaded `kubeconfig` between the API Gateway and Telemetry Store services.

3. **Access the Application**:
   Open **[http://localhost:3000](http://localhost:3000)** in your web browser.

---

## 📈 Verifying Kubeconfig Upload and Cluster Health

Once the application is running:

1. **Sign In**: Register or login using the mock credentials pre-filled on the screen.
2. **Upload Kubeconfig**:
   - Go to **Workspace Setup** -> **Cluster Connect** from the left navigation sidebar.
   - Select **Kubeconfig Upload** as the *Authentication Method*.
   - Fill in your cluster name under **AKS Cluster Name**.
   - Click **Choose File** and upload your kubeconfig file.
   - Click **Validate Connection** to verify access, then click **Connect Cluster**.
3. **View Dashboard**:
   - Navigate to the **Cluster Health** tab on the left sidebar.
   - The application will automatically connect to your cluster and dynamically display the list of **nodes**, **pods**, running statuses, namespaces, and node availability metrics!
