/**
 * 交互式算法实验室 - 基于 Pyodide 的 Python 运行环境
 */

// 已缓存的算法代码
const presetCache = {};
let editorInstance = null; // 全局 CodeMirror 实例

async function loadAndSetAlgo(algoName) {
    const setEditorValue = (val) => {
        if (editorInstance) {
            editorInstance.setValue(val);
        } else {
            document.getElementById('code-editor').value = val;
        }
    };

    if (presetCache[algoName]) {
        setEditorValue(presetCache[algoName]);
    } else {
        setEditorValue('# 正在加载算法代码...');
        try {
            // 从本站静态文件中获取相应的 python 预设文件
            const res = await fetch(`/algorithm-lab/${algoName}.py`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const code = await res.text();
            presetCache[algoName] = code;
            setEditorValue(code);
        } catch (e) {
            setEditorValue('# 算法加载失败，请检查网络或确认文件存在。');
            console.error(e);
        }
    }
    
    // 重置右侧图表为占位符
    document.getElementById('processed-plot-img').style.display = 'none';
    document.getElementById('proc-placeholder').style.display = 'block';
}

let pyodideInstance = null;

async function preloadPythonModule(moduleName) {
    const response = await fetch(`/algorithm-lab/${moduleName}.py`);
    if (!response.ok) throw new Error(`模块加载失败: ${moduleName}.py`);
    const code = await response.text();
    pyodideInstance.FS.writeFile(`/${moduleName}.py`, code);
}

async function initPyodideWorkspace() {
    const statusEl = document.getElementById('py-loading-status');
    if (!statusEl) return; // 页面当前不包含 lab 时不执行

    try {
        statusEl.innerText = '⏳ 正在加载 Pyodide WebAssembly 核心...';
        statusEl.className = 'algo-status loading';
        
        pyodideInstance = await loadPyodide();
        
        statusEl.innerText = '⏳ 正在加载 numpy, scipy, matplotlib... 这通常会花费几秒钟。';
        await pyodideInstance.loadPackage(['numpy', 'scipy', 'matplotlib']);

        statusEl.innerText = '⏳ 正在初始化算法公共模块...';
        await preloadPythonModule('common');
        await pyodideInstance.runPythonAsync(`
    import sys
    if '/' not in sys.path:
        sys.path.append('/')
    import common
    `);
        
        statusEl.innerText = '⏳ 正在加载并且获取测试数据...';
        
        // 初始化环境并从本地生成这四套不同特征的模拟光谱
        await pyodideInstance.runPythonAsync(`
import numpy as np
import matplotlib.pyplot as plt
import io, base64

# ================= 数据集生成区 =================
t = np.linspace(0, 10, 500)
# 干净的双峰特征光谱主成分
y_clean = np.exp(-((t - 3)**2) / 0.5) + 0.6 * np.exp(-((t - 7)**2) / 1.0)
np.random.seed(42)

# 1. 噪声数据 (高频随机噪声 + 脉冲尖峰)
noise = np.random.normal(0, 0.1, t.shape)
spikes = np.zeros_like(t)
spike_indices = np.random.choice(len(t), 8, replace=False)
spikes[spike_indices] = np.random.uniform(1.0, 2.0, 8) * np.random.choice([-1, 1], 8)
y_noisy = y_clean + noise + spikes

# 2. 基线漂移数据 (强力低频正弦/指数漂移)
baseline_drift = 2.0 * np.exp(0.15 * t) - 1.0 + 0.5 * np.sin(0.5 * t)
y_baseline = y_clean + baseline_drift + noise * 0.3

# 3. 重叠宽峰数据 (距离极近无法直接分离的两个峰，用于导数)
y_overlap = np.exp(-((t - 5)**2) / 0.8) + 0.8 * np.exp(-((t - 5.5)**2) / 0.8) + noise * 0.05

# 4. 多变量散射光谱 (2D矩阵，5条随机成比例放缩与偏移，用于MSC/PCA)
y_multi = np.zeros((5, len(t)))
for i in range(5):
    scale = np.random.uniform(0.6, 1.4)
    offset = np.random.uniform(-0.3, 0.3)
    y_multi[i, :] = y_clean * scale + offset + np.random.normal(0, 0.04, t.shape)

# 全局字典保存这四大类数据集
mock_datasets = {
    'noisy': y_noisy,
    'baseline': y_baseline,
    'overlapping': y_overlap,
    'multivariate': y_multi
}

# 默认第一项
y_input = mock_datasets['noisy']
y_noise = y_input # 兼容老代码

# 仅对高频脉冲数据集(noisy)锁定y轴范围，其余数据集保持自适应y轴
current_dataset_key = 'noisy'
noisy_ylim = None

def switch_dataset(key):
    global y_input, y_noise, current_dataset_key
    current_dataset_key = key
    y_input = mock_datasets.get(key, mock_datasets['noisy'])
    y_noise = y_input # 兼容
    return plot_img_b64(y_input, "Original Simulated Signal", "#6c757d", is_original=True)

def _apply_preprocess_1d(y, method):
    if method == 'sg':
        from scipy.signal import savgol_filter
        win = 21 if len(y) >= 21 else (len(y) // 2) * 2 + 1
        if win < 5:
            return y
        return savgol_filter(y, window_length=win, polyorder=3)
    if method == 'fir':
        m = 15
        kernel = np.ones(m) / m
        return np.convolve(y, kernel, mode='same')
    if method == 'median':
        from scipy.signal import medfilt
        return medfilt(y, kernel_size=11)
    return y

def apply_preprocess(method):
    # 返回处理后的输入，并同步到 y_noise 兼容旧算法模板
    global y_noise
    if method == 'none' or method is None:
        y_noise = y_input
        return y_noise
    arr = np.asarray(y_input)
    if arr.ndim == 1:
        y_noise = _apply_preprocess_1d(arr, method)
    else:
        y_noise = np.vstack([_apply_preprocess_1d(row, method) for row in arr])
    return y_noise

def plot_img_b64(y_data, title, color, is_original=False):
    global noisy_ylim
    plt.close('all')
    fig, ax = plt.subplots(figsize=(6, 4))
    
    # 兼容多光谱矩阵的绘制 (2D Array)
    if getattr(y_data, 'ndim', 1) == 2:
        colors = plt.cm.tab10(np.linspace(0, 1, y_data.shape[0]))
        for idx in range(y_data.shape[0]):
            ax.plot(t, y_data[idx], color=colors[idx], linewidth=1.2, alpha=0.8)
    else:
        ax.plot(t, y_data, color=color, linewidth=1.5, alpha=0.9)
        
    ax.set_title(title, fontsize=12, fontweight='bold')
    ax.set_xlabel("Time / Wavelength Index")
    ax.set_ylabel("Amplitude")
    
    ax.set_xlim([t.min(), t.max()])
    
    if is_original:
        # 仅记录 noisy 数据集的原始 y 轴范围
        if current_dataset_key == 'noisy':
            noisy_ylim = ax.get_ylim()
    else:
        # 仅 noisy 数据集处理图固定 y 轴，其余数据集取消固定
        if current_dataset_key == 'noisy' and noisy_ylim is not None:
            ax.set_ylim(noisy_ylim)
            
    ax.grid(True, linestyle='--', alpha=0.5)
    plt.tight_layout()
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')
        `);

        // 默认显示第一项数据集图像
        const origB64 = await pyodideInstance.runPythonAsync(`switch_dataset('noisy')`);
        
        document.getElementById('orig-placeholder').style.display = 'none';
        const origImg = document.getElementById('original-plot-img');
        origImg.src = "data:image/png;base64," + origB64;
        origImg.style.display = 'block';

        statusEl.innerText = '✅ Python 数据科学环境已就绪！请选择算法并点击运行。';
        statusEl.className = 'algo-status success';
        
        const runBtn = document.getElementById('run-btn');
        runBtn.disabled = false;
        
        // 将默认算法填入编辑器
        const selectEl = document.getElementById('algo-select');
        selectEl.dispatchEvent(new Event('change'));
        
    } catch (err) {
        statusEl.innerText = '❌ 加载失败，请检查网络设置。如果使用代理环境，请尝试刷新。';
        statusEl.className = 'algo-status error';
        console.error("Pyodide env init error:", err);
    }
}

function setupEventListeners() {
    const selectEl = document.getElementById('algo-select');
    const datasetSelectEl = document.getElementById('dataset-select');
    const preprocessSelectEl = document.getElementById('preprocess-select');
    const runBtn = document.getElementById('run-btn');

    if (datasetSelectEl) {
        datasetSelectEl.addEventListener('change', async (e) => {
            if (!pyodideInstance) {
                alert("Python 环境挂载中，请稍后重试");
                return;
            }
            try {
                const origB64 = await pyodideInstance.runPythonAsync(`switch_dataset("${e.target.value}")`);
                const origImg = document.getElementById('original-plot-img');
                origImg.src = "data:image/png;base64," + origB64;
                
                // 重置右侧图表
                document.getElementById('processed-plot-img').style.display = 'none';
                document.getElementById('proc-placeholder').style.display = 'block';
            } catch(err) {
                console.error('数据集切换失败:', err);
            }
        });
    }

    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            loadAndSetAlgo(e.target.value);
        });
    }

    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            if (!pyodideInstance) return;
            
            runBtn.disabled = true;
            runBtn.innerText = '正在运行计算...';
            runBtn.style.opacity = '0.7';
            
            const code = editorInstance ? editorInstance.getValue() : document.getElementById('code-editor').value;
            const preprocessMethod = preprocessSelectEl ? preprocessSelectEl.value : 'none';
            
            const escapedCode = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
            
            const wrapper = `
import traceback
try:
    apply_preprocess('${preprocessMethod}')
    exec("${escapedCode}", globals())
    if 'y_processed' not in globals():
        _res_ = "ERROR: 代码执行完毕，但未在全局找到 y_processed 变量。请检查是否为其赋值。"
    else:
        _res_ = plot_img_b64(globals()['y_processed'], "Processed Signal", "#0d6efd")
except Exception as e:
    _res_ = "ERROR:\\n" + traceback.format_exc()

_res_
`;
            try {
                const res = await pyodideInstance.runPythonAsync(wrapper);
                if (res && typeof res === 'string' && !res.startsWith('ERROR:')) { 
                    document.getElementById('proc-placeholder').style.display = 'none';
                    const procImg = document.getElementById('processed-plot-img');
                    procImg.src = "data:image/png;base64," + res;
                    procImg.style.display = 'block';
                } else {
                    alert("运行异常:\\n" + (res || "返回值为空/undefined"));
                }
            } catch(err) {
                alert("执行出错了，代码可能有语法错误:\\n" + (err.message || err));
            } finally {
                runBtn.disabled = false;
                runBtn.innerText = '运行算法';
                runBtn.style.opacity = '1';
            }
        });
    }
}

// 在页面加载后启动初始化及事件绑定
document.addEventListener('DOMContentLoaded', () => {
    // 检查并初始化 CodeMirror 编辑器
    const textarea = document.getElementById('code-editor');
    if (textarea && typeof CodeMirror !== 'undefined') {
        editorInstance = CodeMirror.fromTextArea(textarea, {
            mode: "python",
            theme: "dracula",
            lineNumbers: true,
            indentUnit: 4,
            matchBrackets: true,
            viewportMargin: Infinity
        });
    }

    setupEventListeners();
    initPyodideWorkspace();
});