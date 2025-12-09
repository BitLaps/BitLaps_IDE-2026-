let editor;
let isDarkTheme = true;
let currentCode = '';

window.onload = function() {
    initializeEditor();
    setupEventListeners();
    loadPreferences();
    updateStatus('Ready');
};

function initializeEditor() {
    editor = ace.edit('editor');
    editor.setTheme(isDarkTheme ? 'ace/theme/one_dark' : 'ace/theme/chrome');
    editor.session.setMode('ace/mode/javascript');
    editor.setValue(`// Welcome to Simple IDE!`, -1);
    editor.setOptions({
        fontSize: '14px',
        showPrintMargin: false,
        wrap: true,
        showLineNumbers: true,
        showGutter: true,
        tabSize: 2,
        useSoftTabs: true,
        highlightActiveLine: true,
        enableBasicAutocompletion: true,
        enableLiveAutocompletion: true,
        enableSnippets: true
    });
    editor.session.on('changeCursor', updateLineInfo);
    editor.session.on('change', updateFileSize);
    editor.focus();
}

function setupEventListeners() {
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    document.getElementById('runBtn').addEventListener('click', runCode);
    document.getElementById('downloadBtn').addEventListener('click', downloadCode);
    document.getElementById('clearOutput').addEventListener('click', clearOutput);
    document.getElementById('language').addEventListener('change', function() {
        updateEditorMode(this.value);
        updateDefaultCode(this.value);
        updateFileName();
    });
    document.getElementById('filename').addEventListener('blur', updateFileName);
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            downloadCode();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === '/') {
            e.preventDefault();
            editor.toggleCommentLines();
        }
    });
}

function loadPreferences() {
    const savedTheme = localStorage.getItem('ide-theme');
    if (savedTheme) {
        isDarkTheme = savedTheme === 'dark';
        updateTheme();
    }
    const savedLanguage = localStorage.getItem('ide-language');
    if (savedLanguage) {
        document.getElementById('language').value = savedLanguage;
        updateEditorMode(savedLanguage);
    }
}

function toggleTheme() {
    isDarkTheme = !isDarkTheme;
    updateTheme();
    localStorage.setItem('ide-theme', isDarkTheme ? 'dark' : 'light');
}

function updateTheme() {
    const themeIcon = document.querySelector('#themeToggle i');
    const html = document.documentElement;
    
    if (isDarkTheme) {
        html.setAttribute('data-theme', 'dark');
        editor.setTheme('ace/theme/one_dark');
        themeIcon.className = 'fas fa-moon';
        themeIcon.title = 'Switch to Light Mode';
    } else {
        html.setAttribute('data-theme', 'light');
        editor.setTheme('ace/theme/chrome');
        themeIcon.className = 'fas fa-sun';
        themeIcon.title = 'Switch to Dark Mode';
    }
}

function updateEditorMode(language) {
    const modeMap = {
        'javascript': 'ace/mode/javascript',
        'html': 'ace/mode/html',
        'css': 'ace/mode/css',
        'pseudocode': 'ace/mode/text'  
    };
    
    if (modeMap[language]) {
        editor.session.setMode(modeMap[language]);
        localStorage.setItem('ide-language', language);
    }
}

function updateDefaultCode(language) {
    const currentContent = editor.getValue().trim();
    const isEmpty = !currentContent || 
                    currentContent === '// Welcome to Simple IDE' ||
                    currentContent.includes('// Start coding here');
    
    if (isEmpty) {
        const defaultCodes = {
            'javascript': `// Welcome to Simple IDE`
        };
        
        if (defaultCodes[language]) {
            editor.setValue(defaultCodes[language], -1);
        }
    }
}

function updateFileName() {
    const language = document.getElementById('language').value;
    const filenameInput = document.getElementById('filename');
    let filename = filenameInput.value.trim();
    const extensions = {
        'javascript': '.js',
        'html': '.html',
        'css': '.css',
        'pseudocode': '.txt' 
    };
    
    const ext = extensions[language] || '.txt';
    const filenameWithoutExt = filename.split('.').slice(0, -1).join('.');
    filename = filenameWithoutExt ? filenameWithoutExt + ext : 'file' + ext;
    filenameInput.value = filename;
}

function runCode() {
    const language = document.getElementById('language').value;
    const code = editor.getValue();
    
    updateStatus('Running...');
    clearOutput();
    addOutput('info', `Running ${language.toUpperCase()} code...`, true);
    
    try {
        switch (language) {
            case 'javascript':
                runJavaScript(code);
                break;
            case 'html':
                runHTML(code);
                break;
            case 'css':
                runCSS(code);
                break;
            case 'pseudocode':
                runPseudocode(code);
                break;
            default:
                addOutput('warning', `Language "${language}" not supported.`);
        }
    } catch (error) {
        addOutput('error', `Execution Error: ${error.message}`);
        updateStatus('Error');
    }
}

function runJavaScript(code) {
    try {
        const logs = [];
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.log = (...args) => {
            logs.push(args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '));
            originalLog.apply(console, args);
        };
        
        console.error = (...args) => {
            logs.push(`ERROR: ${args.join(' ')}`);
            originalError.apply(console, args);
        };
        
        console.warn = (...args) => {
            logs.push(`WARNING: ${args.join(' ')}`);
            originalWarn.apply(console, args);
        };

        eval(code);
    
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        if (logs.length === 0) {
            addOutput('success', 'Code executed successfully. No output.');
        } else {
            logs.forEach(log => {
                addOutput('success', log);
            });
        }
        
        updateStatus('Execution completed');
        
    } catch (error) {
        addOutput('error', `JavaScript Error: ${error.message}`);
        updateStatus('Execution failed');
    }
}

function runHTML(code) {
    try {
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(code);
            newWindow.document.close();
            addOutput('success', '✅ HTML opened in new tab.');
            addOutput('info', 'Check your browser for the HTML output.');
            updateStatus('HTML opened');
        } else {
            addOutput('warning', '⚠️ Popup blocked. Please allow popups to view HTML output.');
            addOutput('info', 'HTML preview (first 1000 characters):');
            addOutput('info', code.substring(0, 1000) + (code.length > 1000 ? '...' : ''));
            updateStatus('Popup blocked');
        }
    } catch (error) {
        addOutput('error', `HTML Error: ${error.message}`);
    }
}

function runCSS(code) {
    try {
        const testHTML = `
<!DOCTYPE html>
<html>
<head>
    <style>${code}</style>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        .test-container {
            border: 2px dashed #ccc;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .css-preview {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            font-family: monospace;
            white-space: pre-wrap;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <h2>CSS Preview</h2>
    <p>Your CSS has been applied to this preview page.</p>
    
    <div class="test-container">
        <h3>Test Elements</h3>
        <button class="test-btn">Test Button</button>
        <div class="test-box">Test div with class</div>
        <p class="test-text">This is a paragraph to test text styles.</p>
    </div>
    
    <h3>Your CSS Code:</h3>
    <div class="css-preview">${code}</div>
</body>
</html>`;
        
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(testHTML);
            newWindow.document.close();
            addOutput('success', '✅ CSS preview opened in new tab.');
            addOutput('info', 'Your CSS has been applied to test elements.');
            updateStatus('CSS preview opened');
        } else {
            addOutput('warning', '⚠️ Popup blocked. Showing CSS analysis:');
            analyzeCSS(code);
        }
    } catch (error) {
        addOutput('error', `CSS Error: ${error.message}`);
    }
}

function analyzeCSS(code) {
    // Analyze CSS and provide feedback
    addOutput('info', 'CSS Analysis:');
    
    const rules = code.split('}').length - 1;
    addOutput('info', `Found ${rules} CSS rule(s)`);
    
    if (code.includes('@media')) {
        addOutput('info', '✅ Contains responsive media queries');
    }
    
    if (code.includes('animation') || code.includes('@keyframes')) {
        addOutput('info', '✅ Contains animations');
    }
    
    if (code.includes('gradient')) {
        addOutput('info', '✅ Contains gradients');
    }
    
    addOutput('info', 'Your CSS code:');
    addOutput('info', code.substring(0, 500) + (code.length > 500 ? '...' : ''));
}

function runPseudocode(code) {
    try {
        addOutput('success', '📝 Pseudocode Execution');
        addOutput('info', 'Pseudocode is interpreted for understanding, not executed.');

        const lines = code.split('\n');
        let variables = {};
        let output = [];
        
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//')) {
                return;
            }
            if (trimmed.toUpperCase().includes('DISPLAY')) {
                const displayMatch = trimmed.match(/DISPLAY\s+(.+)/i);
                if (displayMatch) {
                    let message = displayMatch[1].trim();
                    message = message.replace(/^["']|["']$/g, '');
                    Object.keys(variables).forEach(varName => {
                        const regex = new RegExp(varName, 'g');
                        message = message.replace(regex, variables[varName]);
                    });
                    
                    output.push(message);
                }
            }
            else if (trimmed.toUpperCase().startsWith('SET')) {
                const setMatch = trimmed.match(/SET\s+(\w+)\s+TO\s+(.+)/i);
                if (setMatch) {
                    const varName = setMatch[1];
                    let value = setMatch[2].trim();
             
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1);
                    }
                    
                    if (!isNaN(value)) {
                        value = Number(value);
                    } else if (value === 'TRUE') {
                        value = true;
                    } else if (value === 'FALSE') {
                        value = false;
                    }
                    
                    variables[varName] = value;
                    addOutput('info', `Set ${varName} = ${value}`);
                }
            }
            
            else if (trimmed.toUpperCase().startsWith('IF')) {
                addOutput('info', `Line ${index + 1}: ${trimmed}`);
            }

            else if (trimmed.toUpperCase().includes('WHILE') || trimmed.toUpperCase().includes('FOR')) {
                addOutput('info', `Line ${index + 1}: ${trimmed}`);
            }

            else if (trimmed.toUpperCase().startsWith('FUNCTION')) {
                addOutput('info', `Line ${index + 1}: ${trimmed}`);
            }
            
      
            else if (trimmed.toUpperCase() === 'BEGIN' || trimmed.toUpperCase() === 'END') {
         
            }
            
       
            else if (trimmed.length > 3 && !trimmed.startsWith('END')) {
                addOutput('info', `Line ${index + 1}: ${trimmed}`);
            }
        });
        
    
        if (output.length > 0) {
            addOutput('success', 'Simulated Output:');
            output.forEach(msg => {
                addOutput('success', `  ${msg}`);
            });
        }

        if (Object.keys(variables).length > 0) {
            addOutput('info', 'Final Variables:');
            Object.keys(variables).forEach(varName => {
                addOutput('info', `  ${varName} = ${variables[varName]}`);
            });
        }
        
        addOutput('success', '✅ Pseudocode interpretation complete');
        updateStatus('Pseudocode interpreted');
        
    } catch (error) {
        addOutput('error', `Pseudocode Error: ${error.message}`);
        updateStatus('Interpretation failed');
    }
}

function downloadCode() {
    const language = document.getElementById('language').value;
    let filename = document.getElementById('filename').value.trim();
    
    const extensions = {
        'javascript': '.js',
        'html': '.html',
        'css': '.css',
        'pseudocode': '.txt'  
    };
    
    const ext = extensions[language] || '.txt';
    
    if (!filename.endsWith(ext)) {
        const filenameWithoutExt = filename.split('.').slice(0, -1).join('.');
        filename = filenameWithoutExt ? filenameWithoutExt + ext : 'file' + ext;
        document.getElementById('filename').value = filename;
    }
    
    const code = editor.getValue();
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addOutput('success', `✅ Downloaded: ${filename}`);
    updateStatus(`Downloaded ${filename}`);
}

function clearOutput() {
    document.getElementById('output').innerHTML = '';
    updateStatus('Output cleared');
}

function addOutput(type, message, showTimestamp = false) {
    const output = document.getElementById('output');
    const timestamp = showTimestamp ? `<small>${new Date().toLocaleTimeString()}</small> ` : '';
    
    const div = document.createElement('div');
    div.className = `output-message output-${type}`;
    div.innerHTML = `${timestamp}${message}`;
    
    output.appendChild(div);
    
  
    output.scrollTop = output.scrollHeight;
}

function updateLineInfo() {
    const cursor = editor.getCursorPosition();
    document.getElementById('lineInfo').textContent = `Line ${cursor.row + 1}, Column ${cursor.column + 1}`;
}

function updateFileSize() {
    const content = editor.getValue();
    const chars = content.length;
    const lines = content.split('\n').length;
    document.getElementById('fileSize').textContent = `${chars} chars, ${lines} lines`;
}

function updateStatus(message) {
    document.getElementById('status').textContent = message;
}


document.addEventListener('DOMContentLoaded', function() {
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
});