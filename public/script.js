document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('messageForm');
    const authTokenInput = document.getElementById('authToken');
    const numbersInput = document.getElementById('numbers');
    const messageInput = document.getElementById('message');
    const excelFileInput = document.getElementById('excelFile');
    const sendBtn = document.getElementById('sendBtn');
    const toggleTokenBtn = document.getElementById('toggleToken');
    const result = document.getElementById('result');
    const detailedResults = document.getElementById('detailedResults');
    const charCount = document.getElementById('charCount');
    const numberCount = document.getElementById('numberCount');
    const btnText = document.querySelector('.btn-text');
    const loading = document.querySelector('.loading');
    const fileInfo = document.getElementById('fileInfo');
    
    // Botões de modo
    const manualModeBtn = document.getElementById('manualModeBtn');
    const excelModeBtn = document.getElementById('excelModeBtn');
    const manualOnlyElements = document.querySelectorAll('.manual-only');
    const excelOnlyElements = document.querySelectorAll('.excel-only');
    
    let currentMode = 'manual';
    
    // Alternar entre modos
    manualModeBtn.addEventListener('click', function() {
        switchMode('manual');
    });
    
    excelModeBtn.addEventListener('click', function() {
        switchMode('excel');
    });
    
    function switchMode(mode) {
        currentMode = mode;
        
        if (mode === 'manual') {
            manualModeBtn.classList.add('active');
            excelModeBtn.classList.remove('active');
            manualOnlyElements.forEach(el => el.style.display = 'block');
            excelOnlyElements.forEach(el => el.style.display = 'none');
            numbersInput.required = true;
            excelFileInput.required = false;
        } else {
            excelModeBtn.classList.add('active');
            manualModeBtn.classList.remove('active');
            manualOnlyElements.forEach(el => el.style.display = 'none');
            excelOnlyElements.forEach(el => el.style.display = 'block');
            numbersInput.required = false;
            excelFileInput.required = true;
        }
        
        // Limpar resultados
        result.style.display = 'none';
        detailedResults.style.display = 'none';
    }

    // Toggle para mostrar/ocultar token
    toggleTokenBtn.addEventListener('click', function() {
        if (authTokenInput.type === 'password') {
            authTokenInput.type = 'text';
            toggleTokenBtn.textContent = '🙈';
        } else {
            authTokenInput.type = 'password';
            toggleTokenBtn.textContent = '👁️';
        }
    });

    // Contador de caracteres
    messageInput.addEventListener('input', function() {
        charCount.textContent = this.value.length;
    });

    // Contador de números (modo manual)
    numbersInput.addEventListener('input', function() {
        const numbers = this.value.split(/[,;\n\r]+/)
            .map(num => num.trim())
            .filter(num => num.length > 0);
        numberCount.textContent = numbers.length;
        
        // Atualizar texto do botão
        if (numbers.length > 1) {
            btnText.textContent = `📤 Enviar para ${numbers.length} números`;
        } else if (numbers.length === 1) {
            btnText.textContent = '📤 Enviar Mensagem';
        } else {
            btnText.textContent = '📤 Enviar Mensagem(ns)';
        }
    });
    
    // Manipulação do arquivo Excel
    excelFileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const fileSize = (file.size / 1024 / 1024).toFixed(2);
            fileInfo.innerHTML = `
                <div class="file-selected">
                    📊 <strong>${file.name}</strong><br>
                    <small>Tamanho: ${fileSize} MB</small>
                </div>
            `;
            btnText.textContent = '📤 Processar Excel e Enviar';
        } else {
            fileInfo.innerHTML = '';
            btnText.textContent = '📤 Enviar Mensagem(ns)';
        }
    });

    // Envio do formulário
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const authToken = authTokenInput.value.trim();
        const message = messageInput.value.trim();

        // Validações básicas
        if (!authToken) {
            showResult('Token de autorização é obrigatório!', 'error');
            return;
        }

        if (!message) {
            showResult('Mensagem é obrigatória!', 'error');
            return;
        }

        // Desabilitar botão e mostrar loading
        sendBtn.disabled = true;
        btnText.style.display = 'none';
        loading.style.display = 'inline';
        result.style.display = 'none';
        detailedResults.style.display = 'none';

        try {
            if (currentMode === 'excel') {
                await handleExcelUpload(authToken, message);
            } else {
                await handleManualSend(authToken, message);
            }
        } catch (error) {
            console.error('Erro:', error);
            showResult('❌ Erro inesperado. Tente novamente.', 'error');
        } finally {
            // Reabilitar botão
            sendBtn.disabled = false;
            btnText.style.display = 'inline';
            loading.style.display = 'none';
        }
    });
    
    async function handleExcelUpload(authToken, message) {
        const file = excelFileInput.files[0];
        
        if (!file) {
            showResult('Selecione um arquivo Excel!', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('excelFile', file);
        formData.append('authToken', authToken);
        formData.append('message', message);
        
        const response = await fetch('/api/upload-excel', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success || data.summary) {
            const summary = data.summary;
            let resultMessage = `📊 Relatório de Envio (Excel):\n`;
            resultMessage += `✅ Sucessos: ${summary.success}\n`;
            resultMessage += `❌ Erros: ${summary.errors}\n`;
            resultMessage += `📱 Total: ${summary.total}`;
            
            showResult(resultMessage, data.success ? 'success' : 'warning');
            showDetailedResults(data.results, true);
            
            if (data.success) {
                messageInput.value = '';
                charCount.textContent = '0';
                excelFileInput.value = '';
                fileInfo.innerHTML = '';
            }
        } else {
            if (data.errorType === 'auth') {
                showResult(`🔐 Token Inválido: ${data.message}`, 'error auth-error');
                authTokenInput.classList.add('error-field');
                setTimeout(() => {
                    authTokenInput.classList.remove('error-field');
                }, 3000);
            } else {
                showResult(`❌ Erro: ${data.message}`, 'error');
            }
        }
    }
    
    async function handleManualSend(authToken, message) {
        const numbers = numbersInput.value.trim();
        
        if (!numbers) {
            showResult('Pelo menos um número é obrigatório!', 'error');
            return;
        }
        
        const numberList = numbers.split(/[,;\n\r]+/)
            .map(num => num.trim())
            .filter(num => num.length > 0);

        if (numberList.length === 0) {
            showResult('Nenhum número válido encontrado!', 'error');
            return;
        }
        
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                authToken: authToken,
                numbers: numbers,
                body: message
            })
        });

        const data = await response.json();

        if (data.success || data.summary) {
            const summary = data.summary;
            let resultMessage = `📊 Relatório de Envio:\n`;
            resultMessage += `✅ Sucessos: ${summary.success}\n`;
            resultMessage += `❌ Erros: ${summary.errors}\n`;
            resultMessage += `📱 Total: ${summary.total}`;
            
            showResult(resultMessage, data.success ? 'success' : 'warning');
            showDetailedResults(data.results, false);
            
            if (data.success) {
                messageInput.value = '';
                charCount.textContent = '0';
            }
        } else {
            if (data.errorType === 'auth') {
                showResult(`🔐 Token Inválido: ${data.message}`, 'error auth-error');
                authTokenInput.classList.add('error-field');
                setTimeout(() => {
                    authTokenInput.classList.remove('error-field');
                }, 3000);
            } else {
                showResult(`❌ Erro: ${data.message}`, 'error');
            }
        }
    }

    function showResult(message, type) {
        result.textContent = message;
        result.className = `result ${type}`;
        result.style.display = 'block';
        
        result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    function showDetailedResults(results, isExcel) {
        if (!results || results.length === 0) return;
        
        let html = '<h3>📋 Resultados Detalhados:</h3><div class="results-list">';
        
        results.forEach((result, index) => {
            const statusIcon = result.status === 'success' ? '✅' : '❌';
            const statusClass = result.status === 'success' ? 'success-item' : 'error-item';
            
            html += `
                <div class="result-item ${statusClass}">
                    <div class="result-header">
                        ${statusIcon} <strong>${result.originalNumber}</strong>
                        ${result.normalizedNumber !== result.originalNumber ? 
                            `<small>(normalizado: ${result.normalizedNumber})</small>` : ''}
                    </div>
            `;
            
            if (isExcel) {
                html += `
                    <div class="excel-info">
                        <small><strong>Nome:</strong> ${result.nome} | <strong>Protocolo:</strong> ${result.protocolo}</small>
                    </div>
                `;
            }
            
            html += `
                    <div class="result-message">${result.statusMessage || result.message}</div>
                </div>
            `;
        });
        
        html += '</div>';
        
        detailedResults.innerHTML = html;
        detailedResults.style.display = 'block';
    }

    // Salvar token no localStorage
    authTokenInput.addEventListener('change', function() {
        if (this.value.trim()) {
            localStorage.setItem('whatsapp_token', this.value.trim());
        }
    });

    // Carregar token salvo
    const savedToken = localStorage.getItem('whatsapp_token');
    if (savedToken) {
        authTokenInput.value = savedToken;
    }
});