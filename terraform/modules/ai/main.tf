resource "azurerm_cognitive_account" "ai" {
  name                = var.ai_account_name
  location            = var.location
  resource_group_name = var.resource_group_name
  kind                = "OpenAI"
  sku_name            = "S0"
  tags                = var.tags
}