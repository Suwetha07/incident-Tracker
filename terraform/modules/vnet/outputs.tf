output "vnet_id" { value = azurerm_virtual_network.vnet.id }
output "aks_subnet_id" { value = azurerm_subnet.aks.id }
output "sql_subnet_id" { value = azurerm_subnet.sql.id }
output "pe_subnet_id" { value = azurerm_subnet.pe.id }
output "appgw_subnet_id" { value = azurerm_subnet.appgw.id }