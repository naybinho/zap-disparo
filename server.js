// Carregar variáveis de ambiente
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const API_ENDPOINT = process.env.API_ENDPOINT || 'https://apiwhaticket.naybinho.com.br/api/messages/send';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB
const SEND_DELAY = parseInt(process.env.SEND_DELAY) || 1000; // 1 segundo

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        // Aceitar apenas arquivos Excel
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.xlsx') || 
            file.originalname.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos Excel (.xlsx, .xls) são permitidos!'), false);
        }
    },
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Função para normalizar número (adicionar 55 se necessário)
function normalizePhoneNumber(number) {
    // Remove todos os caracteres não numéricos
    const cleanNumber = number.toString().replace(/\D/g, '');
    
    // Se o número tem 11 dígitos (DDD + 9 dígitos), adiciona 55
    if (cleanNumber.length === 11 && !cleanNumber.startsWith('55')) {
        return '55' + cleanNumber;
    }
    
    // Se o número tem 10 dígitos (DDD + 8 dígitos), adiciona 55
    if (cleanNumber.length === 10 && !cleanNumber.startsWith('55')) {
        return '55' + cleanNumber;
    }
    
    // Se já tem 13 dígitos e começa com 55, retorna como está
    if (cleanNumber.length === 13 && cleanNumber.startsWith('55')) {
        return cleanNumber;
    }
    
    // Se já tem 12 dígitos e começa com 55, retorna como está
    if (cleanNumber.length === 12 && cleanNumber.startsWith('55')) {
        return cleanNumber;
    }
    
    // Para outros casos, retorna o número limpo
    return cleanNumber;
}

// Função para processar arquivo Excel
function processExcelFile(filePath) {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);
        
        // Verificar se as colunas obrigatórias existem
        if (data.length === 0) {
            throw new Error('Arquivo Excel está vazio');
        }
        
        const firstRow = data[0];
        const requiredColumns = ['Nome', 'Protocolo', 'Numero'];
        const missingColumns = [];
        
        requiredColumns.forEach(col => {
            if (!(col in firstRow)) {
                // Verificar variações do nome da coluna
                const variations = {
                    'Nome': ['nome', 'NOME', 'Name', 'name'],
                    'Protocolo': ['protocolo', 'PROTOCOLO', 'Protocol', 'protocol'],
                    'Numero': ['numero', 'NUMERO', 'Número', 'NÚMERO', 'Number', 'number', 'Telefone', 'telefone']
                };
                
                let found = false;
                for (let variation of variations[col]) {
                    if (variation in firstRow) {
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    missingColumns.push(col);
                }
            }
        });
        
        if (missingColumns.length > 0) {
            throw new Error(`Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`);
        }
        
        // Normalizar dados
        const normalizedData = data.map((row, index) => {
            // Encontrar os valores das colunas (considerando variações)
            let nome = row.Nome || row.nome || row.NOME || row.Name || row.name || '';
            let protocolo = row.Protocolo || row.protocolo || row.PROTOCOLO || row.Protocol || row.protocol || '';
            let numero = row.Numero || row.numero || row.NUMERO || row.Número || row.NÚMERO || 
                        row.Number || row.number || row.Telefone || row.telefone || '';
            
            // Validações
            if (!nome || !protocolo || !numero) {
                throw new Error(`Linha ${index + 2}: Dados obrigatórios em branco (Nome: ${nome}, Protocolo: ${protocolo}, Número: ${numero})`);
            }
            
            const normalizedNumber = normalizePhoneNumber(numero);
            
            if (normalizedNumber.length < 10) {
                throw new Error(`Linha ${index + 2}: Número inválido: ${numero}`);
            }
            
            return {
                nome: nome.toString().trim(),
                protocolo: protocolo.toString().trim(),
                numero: numero.toString().trim(),
                numeroNormalizado: normalizedNumber
            };
        });
        
        return normalizedData;
        
    } catch (error) {
        throw new Error(`Erro ao processar arquivo Excel: ${error.message}`);
    }
}

// Função para substituir variáveis na mensagem
function replaceMessageVariables(message, data) {
    return message
        .replace(/\{nome\}/gi, data.nome)
        .replace(/\{protocolo\}/gi, data.protocolo)
        .replace(/\{numero\}/gi, data.numero);
}

// Função para enviar mensagem individual
async function sendSingleMessage(number, body, authToken) {
    const config = {
        method: 'POST',
        url: API_ENDPOINT,
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
        },
        data: {
            number: number,
            body: body
        }
    };
    
    return await axios(config);
}

// Rota para servir a página principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Função para gerar saudação baseada no horário
function getGreeting() {
    const now = new Date();
    const hour = now.getHours();
    
    if (hour >= 5 && hour < 12) {
        return 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
        return 'Boa tarde';
    } else {
        return 'Boa noite';
    }
}

// Função para formatar mensagem com saudação, nome e protocolo
function formatMessageWithGreeting(message, data = null) {
    const greeting = getGreeting();
    
    if (data && data.nome && data.protocolo) {
        // Para mensagens do Excel com nome e protocolo
        return `${greeting}, ${data.nome}\nProtocolo: ${data.protocolo}\n\n${message}`;
    } else {
        // Para mensagens manuais, apenas a saudação
        return `${greeting}!\n\n${message}`;
    }
}

// Rota para upload e processamento de arquivo Excel
app.post('/api/upload-excel', upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum arquivo foi enviado',
                errorType: 'validation'
            });
        }
        
        const { authToken, message } = req.body;
        
        if (!authToken || !message) {
            return res.status(400).json({
                success: false,
                message: 'Token de autorização e mensagem são obrigatórios',
                errorType: 'validation'
            });
        }
        
        // Processar arquivo Excel
        const excelData = processExcelFile(req.file.path);
        
        // Resultados do envio
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        
        // Enviar mensagens com delay entre elas
        for (let i = 0; i < excelData.length; i++) {
            const data = excelData[i];
            const personalizedMessage = replaceMessageVariables(message, data);
            const finalMessage = formatMessageWithGreeting(personalizedMessage, data);
            
            try {
                await sendSingleMessage(data.numeroNormalizado, finalMessage, authToken);
                results.push({
                    nome: data.nome,
                    protocolo: data.protocolo,
                    originalNumber: data.numero,
                    normalizedNumber: data.numeroNormalizado,
                    message: finalMessage,
                    status: 'success',
                    statusMessage: 'Enviado com sucesso'
                });
                successCount++;
            } catch (error) {
                let errorMessage = 'Erro desconhecido';
                let errorType = 'unknown';
                
                if (error.response?.status === 401 || error.response?.status === 403) {
                    errorMessage = 'Token inválido';
                    errorType = 'auth';
                } else if (error.response?.status >= 400 && error.response?.status < 500) {
                    errorMessage = error.response?.data?.message || 'Erro na requisição';
                    errorType = 'client';
                } else {
                    errorMessage = 'Erro de servidor';
                    errorType = 'server';
                }
                
                results.push({
                    nome: data.nome,
                    protocolo: data.protocolo,
                    originalNumber: data.numero,
                    normalizedNumber: data.numeroNormalizado,
                    message: finalMessage,
                    status: 'error',
                    statusMessage: errorMessage,
                    errorType: errorType
                });
                errorCount++;
            }
            
            // Delay de 1 segundo entre envios
            if (i < excelData.length - 1) {
                await new Promise(resolve => setTimeout(resolve, SEND_DELAY));
            }
        }
        
        // Remover arquivo temporário
        fs.unlinkSync(req.file.path);
        
        res.json({
            success: errorCount === 0,
            message: `Envio concluído: ${successCount} sucessos, ${errorCount} erros`,
            summary: {
                total: excelData.length,
                success: successCount,
                errors: errorCount
            },
            results: results
        });
        
    } catch (error) {
        console.error('Erro ao processar arquivo Excel:', error.message);
        
        // Remover arquivo temporário em caso de erro
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({
            success: false,
            message: error.message,
            errorType: 'processing'
        });
    }
});

// Rota para envio de mensagens (individual ou em massa)
app.post('/api/send-message', async (req, res) => {
    try {
        const { numbers, body, authToken } = req.body;
        
        // Validação dos dados
        if (!numbers || !body || !authToken) {
            return res.status(400).json({
                success: false,
                message: 'Números, mensagem e token de autorização são obrigatórios',
                errorType: 'validation'
            });
        }

        // Converter string de números em array
        let numberList = [];
        if (typeof numbers === 'string') {
            numberList = numbers.split(/[,;\n\r]+/)
                .map(num => num.trim())
                .filter(num => num.length > 0);
        } else if (Array.isArray(numbers)) {
            numberList = numbers;
        } else {
            numberList = [numbers.toString()];
        }

        if (numberList.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Pelo menos um número deve ser fornecido',
                errorType: 'validation'
            });
        }

        // Normalizar números
        const normalizedNumbers = numberList.map(normalizePhoneNumber);
        
        // Resultados do envio
        const results = [];
        let successCount = 0;
        let errorCount = 0;

        // Enviar mensagens com delay entre elas
        for (let i = 0; i < normalizedNumbers.length; i++) {
            const number = normalizedNumbers[i];
            const originalNumber = numberList[i];
            const finalMessage = formatMessageWithGreeting(body);
            
            try {
                await sendSingleMessage(number, finalMessage, authToken);
                results.push({
                    originalNumber: originalNumber,
                    normalizedNumber: number,
                    status: 'success',
                    message: 'Enviado com sucesso'
                });
                successCount++;
            } catch (error) {
                let errorMessage = 'Erro desconhecido';
                let errorType = 'unknown';
                
                if (error.response?.status === 401 || error.response?.status === 403) {
                    errorMessage = 'Token inválido';
                    errorType = 'auth';
                } else if (error.response?.status >= 400 && error.response?.status < 500) {
                    errorMessage = error.response?.data?.message || 'Erro na requisição';
                    errorType = 'client';
                } else {
                    errorMessage = 'Erro de servidor';
                    errorType = 'server';
                }
                
                results.push({
                    originalNumber: originalNumber,
                    normalizedNumber: number,
                    status: 'error',
                    message: errorMessage,
                    errorType: errorType
                });
                errorCount++;
            }
            
            // Delay de 1 segundo entre envios
            if (i < normalizedNumbers.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        res.json({
            success: errorCount === 0,
            message: `Envio concluído: ${successCount} sucessos, ${errorCount} erros`,
            summary: {
                total: normalizedNumbers.length,
                success: successCount,
                errors: errorCount
            },
            results: results
        });

    } catch (error) {
        console.error('Erro geral ao enviar mensagens:', error.message);
        
        res.status(500).json({
            success: false,
            message: 'Erro interno do servidor',
            errorType: 'server',
            error: error.message
        });
    }
});

// Rota para testar a API
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor funcionando!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🌐 Acesse: http://localhost:${PORT}`);
    console.log(`📡 API Endpoint: ${API_ENDPOINT}`);
    console.log(`📁 Tamanho máximo de arquivo: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`);
    console.log(`⏱️  Delay entre envios: ${SEND_DELAY}ms`);
});