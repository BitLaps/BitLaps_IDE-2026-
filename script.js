let editor;
let isDarkTheme = true;
let currentCode = '';

const JUDGE0_API = 'https://ce.judge0.com';
const JUDGE0_LANGS = {
    cpp:    { label: 'C++',    match: /^C\+\+ \(GCC/i, fallback: 54 }, 
    python: { label: 'Python', match: /^Python \(3/i,  fallback: 71 }
};
const judge0Ids = {};

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
    const languageSelect = document.getElementById('language');
    // Ignore saved languages that no longer exist (html/css were removed)
    if (savedLanguage && [...languageSelect.options].some(o => o.value === savedLanguage)) {
        languageSelect.value = savedLanguage;
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
        'pseudocode': 'ace/mode/text',
        'cpp': 'ace/mode/c_cpp',
        'python': 'ace/mode/python'
    };
    
    if (modeMap[language]) {
        editor.session.setMode(modeMap[language]);
        localStorage.setItem('ide-language', language);
    }
}

const DEFAULT_CODES = {
    'javascript': `// Welcome to Simple IDE!`,
    'python': `# Simple Python Program
print("Hello, Python!")

for i in range(1, 4):
    print("Count:", i)`,
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

function updateDefaultCode(language) {
    const currentContent = editor.getValue().trim();
 
    const isUntouched = !currentContent ||
                        currentContent === '// Welcome to Simple IDE' ||
                        Object.values(DEFAULT_CODES).some(code => code.trim() === currentContent);

    if (isUntouched && DEFAULT_CODES[language]) {
        editor.setValue(DEFAULT_CODES[language], -1);
    }
}

function updateFileName() {
    const language = document.getElementById('language').value;
    const filenameInput = document.getElementById('filename');
    let filename = filenameInput.value.trim();
    const extensions = {
        'javascript': '.js',
        'pseudocode': '.txt',
        'cpp': '.cpp',
        'python': '.py'
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
            case 'pseudocode':
                runPseudocode(code);
                break;
            case 'cpp':
                runWithJudge0(code, 'cpp');
                break;
            case 'python':
                runWithJudge0(code, 'python');
                break;
            default:
                addOutput('warning', `Language "${language}" not supported.`);
        }
    } catch (error) {
        addOutput('error', `Execution Error: ${error.message}`);
        updateStatus('Error');
    }
}


function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function fromBase64(b64) {
    if (!b64) return '';
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

// Pick the newest matching runtime the server offers
async function getJudge0LanguageId(langKey) {
    if (judge0Ids[langKey]) return judge0Ids[langKey];
    const cfg = JUDGE0_LANGS[langKey];
    try {
        const res = await fetch(`${JUDGE0_API}/languages`);
        if (res.ok) {
            const langs = await res.json();
            const found = langs.filter(l => cfg.match.test(l.name)).sort((a, b) => b.id - a.id);
            if (found.length) {
                judge0Ids[langKey] = found[0].id;
                return judge0Ids[langKey];
            }
        }
    } catch (e) { /* fall through to fallback */ }
    judge0Ids[langKey] = cfg.fallback;
    return judge0Ids[langKey];
}

async function runWithJudge0(code, langKey) {
    const cfg = JUDGE0_LANGS[langKey];
    const runBtn = document.getElementById('runBtn');
    runBtn.disabled = true;
    try {
        updateStatus(langKey === 'cpp' ? 'Compiling C++...' : 'Running Python...');

        const languageId = await getJudge0LanguageId(langKey);

        const payload = {
            language_id: languageId,
            source_code: toBase64(code),
            cpu_time_limit: 5,
            wall_time_limit: 10
        };

        const response = await fetch(
            `${JUDGE0_API}/submissions?base64_encoded=true&wait=true&fields=stdout,stderr,compile_output,message,status,time,memory`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }
        );

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Too many requests right now. Wait a few seconds and press Run again.');
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        const statusId = result.status ? result.status.id : 0;
        const stdout = fromBase64(result.stdout);
        const stderr = fromBase64(result.stderr);
        const compileOutput = fromBase64(result.compile_output);
        const message = fromBase64(result.message);

        if (statusId === 6) {
            // Compilation error
            showCleanError(compileOutput || 'Compilation failed');
            updateStatus('Compilation failed');
            return;
        }

        if (stdout) showCleanOutput(stdout);
        if (stderr) showCleanError(stderr);

        if (statusId === 3) {
            if (!stdout && !stderr) addOutput('info', 'Program ran successfully (no output).');
            const t = result.time ? ` in ${result.time}s` : '';
            updateStatus(`Execution completed${t}`);
        } else if (statusId === 5) {
            addOutput('error', 'Time limit exceeded (infinite loop, or waiting for input?).');
            updateStatus('Time limit exceeded');
        } else {
            const desc = result.status ? result.status.description : 'Unknown error';
            if (!stderr || message) addOutput('error', `${desc}${message ? ': ' + message : ''}`);
            updateStatus('Execution failed');
        }

    } catch (error) {
        if (error instanceof TypeError) {
            // fetch() itself failed: offline, blocked, or server unreachable
            addOutput('error', `Could not reach the ${cfg.label} runner service.`);
            addOutput('info', 'Check your internet connection, then try again.');
        } else {
            addOutput('error', error.message);
        }
        updateStatus('Compilation failed');
    } finally {
        runBtn.disabled = false;
    }
}


function showCleanOutput(output) {
    
    addOutput('success', output.replace(/\n$/, ''));
}


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
        'pseudocode': '.txt',
        'cpp': '.cpp',
        'python': '.py'
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
    const div = document.createElement('div');
    div.className = `output-message output-${type}`;
    div.textContent = (showTimestamp ? `[${new Date().toLocaleTimeString()}] ` : '') + message;
    
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
