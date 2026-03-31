/**
 * 交互式算法实验室 - 基于 Pyodide 的 Python 运行环境
 */

// 已缓存的算法代码
const presetCache = {};

async function loadAndSetAlgo(algoName) {
    const editor = document.getElementById('code-editor');
    if (presetCache[algoName]) {
        editor.value = presetCache[algoName];
    } else {
        editor.value = '# 正在加载算法代码...';
        try {
            // 从本站静态文件中获取相应的 python 预设文件
            const res = await fetch(`/algorithm-lab/${algoName}.py`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const code = await res.text();
            presetCache[algoName] = code;
            editor.value = code;
        } catch (e) {
            editor.value = '# 算法加载失败，请检查网络或确认文件存在。';
            console.error(e);
        }
    }
    
    // 重置右侧图表为占位符
    document.getElementById('processed-plot-img').style.display = 'none';
    document.getElementById('proc-placeholder').style.display = 'block';
}

let pyodideInstance = null;

async function initPyodideWorkspace() {
    const statusEl = document.getElementById('py-loading-status');
    if (!statusEl) return; // 页面当前不包含 lab 时不执行

    try {
        statusEl.innerText = '⏳ 正在加载 Pyodide WebAssembly 核心...';
        statusEl.className = 'algo-status loading';
        
        pyodideInstance = await loadPyodide();
        
        statusEl.innerText = '⏳ 正在加载 numpy, scipy, matplotlib... 这通常会花费几秒钟。';
        await pyodideInstance.loadPackage(['numpy', 'scipy', 'matplotlib']);
        
        statusEl.innerText = '⏳ 正在加载并且获取测试数据...';
        
        // 从网站相对路径拉取 CSV 数据并写入 Pyodide 虚拟文件系统
        const dataRes = await fetch('/algorithm-lab/data.csv');
        if (!dataRes.ok) throw new Error("无法拉取数据文件 /algorithm-lab/data.csv");
        const dataText = await dataRes.text();
        pyodideInstance.FS.writeFile('/data.csv', dataText);

        // 初始化环境并从本地挂载的测试数据开始读取
        await pyodideInstance.runPythonAsync(`
import numpy as np
import matplotlib.pyplot as plt
import io, base64

# 读取提前生成好的包含高频和脉冲噪声的光谱信号测试数据
data = np.loadtxt('/data.csv', delimiter=',', skiprows=1)
t = data[:, 0]
y_noise = data[:, 1]

# 获取原始数据的坐标轴范围基准，保证前后对比一致
global_ylim = None

def plot_img_b64(y_data, title, color, is_original=False):
    global global_ylim
    plt.close('all')
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(t, y_data, color=color, linewidth=1.5, alpha=0.9)
    ax.set_title(title, fontsize=12, fontweight='bold')
    ax.set_xlabel("Time / Index")
    ax.set_ylabel("Amplitude")
    
    # x 轴始终保持不变
    ax.set_xlim([t.min(), t.max()])
    
    if is_original:
        # 记录原始信号的y轴范围
        global_ylim = ax.get_ylim()
    else:
        # 对处理后的信号强制使用保存的原始y轴范围，这样可以直观看出平滑效果
        if global_ylim is not None:
            ax.set_ylim(global_ylim)
            
    ax.grid(True, linestyle='--', alpha=0.5)
    plt.tight_layout()
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')
        `);

        // 获取原始带噪信号的 Base64 图片，并设置 is_original 标志位来记录 y 轴范围
        const origB64 = await pyodideInstance.runPythonAsync(`plot_img_b64(y_noise, "Original Corrupted Signal", "#6c757d", is_original=True)`);
        
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
    const runBtn = document.getElementById('run-btn');

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
            
            const code = document.getElementById('code-editor').value;
            
            const escapedCode = code.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
            
            const wrapper = `
import traceback
try:
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
    setupEventListeners();
    initPyodideWorkspace();
});