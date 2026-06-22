output "aks_cluster_name" { value = module.aks.cluster_name }
output "sql_server_fqdn" { value = module.database.sql_server_fqdn }
output "acr_login_server" { value = module.acr.acr_login_server }
output "website_url" { value = "http://" }
