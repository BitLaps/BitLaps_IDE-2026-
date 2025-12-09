let editor;
let isDarkTheme = true;
let currentCode = '';

// Piston API configuration
const PISTON_API = 'https://emkc.org/api/v2/piston/execute';

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
        'pseudocode': 'ace/mode/text',
        'cpp': 'ace/mode/c_cpp'
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
                    currentContent.includes('// Start coding here') ||
                    currentContent === '// Welcome to C++ Mode';
    
    if (isEmpty) {
        const defaultCodes = {
            'javascript': `// Welcome to Simple IDE`,
            'cpp': `// Simple C++ Program
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, C++!" << endl;
    
    for(int i = 1; i <= 3; i++) {
        cout << "Count: " << i << endl;
    }
    
    return 0;
}`
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
        'pseudocode': '.txt',
        'cpp': '.cpp'
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
            case 'cpp':
                runCppWithPiston(code);
                break;
            default:
                addOutput('warning', `Language "${language}" not supported.`);
        }
    } catch (error) {
        addOutput('error', `Execution Error: ${error.message}`);
        updateStatus('Error');
    }
}

// ==============================================
// SIMPLIFIED PISTON API C++ COMPILATION
// ==============================================

async function runCppWithPiston(code) {
    try {
        updateStatus('Compiling C++...');
        
        const payload = {
            language: 'cpp',
            version: '10.2.0',
            files: [{ content: code }],
            stdin: '',
            args: [],
            compile_timeout: 10000,
            run_timeout: 5000
        };
        
        const response = await fetch(PISTON_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Show ONLY the program output or errors
        if (result.compile && result.compile.code !== 0) {
            // Show compilation error
            if (result.compile.output) {
                showCleanError(result.compile.output);
            } else if (result.compile.stderr) {
                showCleanError(result.compile.stderr);
            } else {
                addOutput('error', 'Compilation failed');
            }
            updateStatus('Compilation failed');
        } else if (result.run) {
            // Show program output
            if (result.run.stdout) {
                showCleanOutput(result.run.stdout);
            }
            
            // Show runtime errors if any
            if (result.run.stderr) {
                showCleanError(result.run.stderr);
            }
            
            // Show exit code only if non-zero
            if (result.run.code !== 0) {
                addOutput('error', `Program exited with code: ${result.run.code}`);
            }
            
            updateStatus('Execution completed');
        }
        
    } catch (error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
            addOutput('error', 'Network error. No internet connection.');
            addOutput('info', 'Cannot compile C++ without internet.');
        } else {
            addOutput('error', `Error: ${error.message}`);
        }
        updateStatus('Compilation failed');
    }
}

// Show clean program output
function showCleanOutput(output) {
    const lines = output.split('\n');
    lines.forEach(line => {
        if (line.trim() !== '') {
            addOutput('output', line);
        }
    });
}

// Show clean error output
function showCleanError(errorOutput) {
    const lines = errorOutput.split('\n');
    lines.forEach(line => {
        if (line.trim() !== '') {
            if (line.includes('error:')) {
                addOutput('error', line);
            } else if (line.includes('warning:')) {
                addOutput('warning', line);
            } else {
                addOutput('error', line);
            }
        }
    });
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
            updateStatus('HTML opened');
        } else {
            addOutput('warning', '⚠️ Popup blocked. Please allow popups to view HTML output.');
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
</head>
<body>
    <h2>CSS Preview</h2>
    <div class="test-container">
        <button class="test-btn">Test Button</button>
        <div class="test-box">Test div</div>
        <p class="test-text">Test paragraph</p>
    </div>
</body>
</html>`;
        
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(testHTML);
            newWindow.document.close();
            addOutput('success', '✅ CSS preview opened in new tab.');
            updateStatus('CSS preview opened');
        } else {
            addOutput('warning', '⚠️ Popup blocked.');
            updateStatus('Popup blocked');
        }
    } catch (error) {
        addOutput('error', `CSS Error: ${error.message}`);
    }
}

function runPseudocode(code) {
    try {
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
                }
            }
        });
        
        if (output.length > 0) {
            output.forEach(msg => {
                addOutput('success', msg);
            });
        }
        
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
        'pseudocode': '.txt',
        'cpp': '.cpp'
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
    
    // Auto-scroll to bottom
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