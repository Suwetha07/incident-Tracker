resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

module "vnet" {
  source              = "./modules/vnet"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  vnet_address_space  = var.vnet_address_space
  aks_subnet_prefix   = var.aks_subnet_prefix
  sql_subnet_prefix   = var.sql_subnet_prefix
  pe_subnet_prefix    = var.pe_subnet_prefix
  appgw_subnet_prefix = var.appgw_subnet_prefix
  tags                = var.tags
}

module "aks" {
  source              = "./modules/aks"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  cluster_name        = var.aks_cluster_name
  dns_prefix          = var.aks_dns_prefix
  aks_subnet_id       = module.vnet.aks_subnet_id
  service_cidr        = var.aks_service_cidr
  dns_service_ip      = var.aks_dns_service_ip
  acr_id              = module.acr.acr_id
  tags                = var.tags
}

module "acr" {
  source              = "./modules/acr"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  acr_name            = var.acr_name
  tags                = var.tags
}

module "database" {
  source              = "./modules/database"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  server_name         = var.sql_server_name
  admin_username      = var.sql_admin_username
  admin_password      = var.sql_admin_password
  sql_subnet_id       = module.vnet.sql_subnet_id
  vnet_id             = module.vnet.vnet_id
  tags                = var.tags
}

module "keyvault" {
  source              = "./modules/keyvault"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  kv_name             = var.kv_name
  pe_subnet_id        = module.vnet.pe_subnet_id
  vnet_id             = module.vnet.vnet_id
  tags                = var.tags
}

module "storage" {
  source               = "./modules/storage"
  resource_group_name  = azurerm_resource_group.rg.name
  location             = azurerm_resource_group.rg.location
  storage_account_name = var.storage_account_name
  pe_subnet_id         = module.vnet.pe_subnet_id
  vnet_id              = module.vnet.vnet_id
  tags                 = var.tags
}

module "vm" {
  source              = "./modules/vm"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  subnet_id           = module.vnet.aks_subnet_id
  admin_username      = var.vm_admin_username
  admin_password      = var.vm_admin_password
  tags                = var.tags
}

module "appgw" {
  source              = "./modules/appgw"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  appgw_name          = var.appgw_name
  appgw_subnet_id     = module.vnet.appgw_subnet_id
  tags                = var.tags
}

module "ai" {
  source              = "./modules/ai"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  ai_account_name     = var.ai_foundry_name
  tags                = var.tags
}