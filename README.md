# 📱 Zap Messenger

Sistema completo para envio de mensagens WhatsApp via API com interface web intuitiva.

## 🚀 Funcionalidades

### ✨ Principais Recursos
- **Envio Individual**: Envie mensagens para um número específico
- **Envio em Massa**: Envie para múltiplos números simultaneamente
- **Importação Excel**: Carregue contatos via planilha Excel (.xlsx/.xls)
- **Saudação Automática**: Saudação baseada no horário (Bom dia/Boa tarde/Boa noite)
- **Personalização**: Use variáveis {nome}, {protocolo} nas mensagens
- **Normalização**: Adiciona automaticamente código do país (55) para números brasileiros
- **Relatórios Detalhados**: Acompanhe o status de cada envio
- **Interface Responsiva**: Funciona em desktop e mobile

### 🕐 Saudações Automáticas
- **Bom dia**: 05:00 às 11:59
- **Boa tarde**: 12:00 às 17:59
- **Boa noite**: 18:00 às 04:59

### 📊 Formato Excel Suportado
O arquivo Excel deve conter as colunas:
- **Nome**: Nome do contato
- **Protocolo**: Número do protocolo/identificação
- **Numero**: Número do WhatsApp (com ou sem código do país)

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **Axios** - Cliente HTTP
- **Multer** - Upload de arquivos
- **XLSX** - Processamento de planilhas Excel
- **CORS** - Cross-Origin Resource Sharing

### Frontend
- **HTML5** - Estrutura
- **CSS3** - Estilização responsiva
- **JavaScript** - Interatividade

## 📦 Instalação

### Pré-requisitos
- Node.js (versão 14 ou superior)
- npm ou yarn

### Passos

1. **Clone o repositório**
```bash
git clone https://github.com/naybinho/zap-messenger.git
cd zap-messenger