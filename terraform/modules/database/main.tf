resource "azurerm_postgresql_flexible_server" "sql" {
  name                   = var.server_name
  resource_group_name    = var.resource_group_name
  location               = var.location
  version                = "14"
  delegated_subnet_id    = var.sql_subnet_id
  private_dns_zone_id    = azurerm_private_dns_zone.sql_dns.id
  administrator_login    = var.admin_username
  administrator_password        = var.admin_password
  storage_mb                    = 32768
  sku_name                      = "B_Standard_B1ms"
  public_network_access_enabled = false
  tags                          = var.tags

  lifecycle {
    ignore_changes = [zone, high_availability]
  }
}

resource "azurerm_private_dns_zone" "sql_dns" {
  name                = "private.postgres.database.azure.com"
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "sql_dns_link" {
  name                  = "sql-vnet-link"
  private_dns_zone_name = azurerm_private_dns_zone.sql_dns.name
  virtual_network_id    = var.vnet_id
  resource_group_name   = var.resource_group_name
}