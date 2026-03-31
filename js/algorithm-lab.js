/**
 * 交互式算法实验室 - 基于 Pyodide 的 Python 运行环境
 */

const algoPresets = {
    'sg': `import numpy as np
from scipy.signal import savgol_filter

# t, y_noise 已经在全局环境准备好
# y_noise 为含有随机高频噪声和脉冲杂波的输入信号
# 输出变量必须命名为 y_processed
# 对于 SG 滤波：window_length (窗宽)必须为奇数，polyorder 为多项式拟合阶数
y_processed = savgol_filter(y_noise, window_length=21, polyorder=3)
`,
    'fir': `import numpy as np

# t, y_noise 已经在全局环境准备好
# FIR滑动平均：设定窗宽 M
M = 15
kernel = np.ones(M) / M  # 归一化的矩形窗
# 使用 np.convolve 进行卷积平滑
y_processed = np.convolve(y_noise, kernel, mode='same')
`,
    'median': `import numpy as np
from scipy.signal import medfilt

# t, y_noise 已经在全局环境准备好
# 中值滤波：最拿手的是过滤掉随机出现的极端峰值干扰（如椒盐噪声）
# kernel_size 同样必须为奇数
y_processed = medfilt(y_noise, kernel_size=15)
`
};

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
        
        // 初始化环境与生成测试信号
        await pyodideInstance.runPythonAsync(`
import numpy as np
import matplotlib.pyplot as plt
import io, base64

# 生成基础信号 (带有多个波峰的模拟光谱或缓变信号)
t = np.linspace(0, 10, 500)
y_clean = np.sin(t) + 0.5 * np.cos(3*t) + 0.2 * np.sin(0.5*t)

# 添加高斯白噪声
np.random.seed(42)
noise = np.random.normal(0, 0.15, t.shape)  

# 注入随机尖峰(脉冲杂讯)
spikes = np.zeros_like(t)
spike_indices = np.random.choice(len(t), 12, replace=False)
spikes[spike_indices] = np.random.uniform(2, 3.5, 12) * np.random.choice([-1, 1], 12)

# 合成最终带噪的污染信号
y_noise = y_clean + noise + spikes

def plot_img_b64(y_data, title, color):
    plt.close('all')
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(t, y_data, color=color, linewidth=1.5, alpha=0.9)
    ax.set_title(title, fontsize=12, fontweight='bold')
    ax.set_xlabel("Time / Index")
    ax.set_ylabel("Amplitude")
    ax.grid(True, linestyle='--', alpha=0.5)
    plt.tight_layout()
    
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode('utf-8')
        `);

        // 获取原始带噪信号的 Base64 图片
        const origB64 = await pyodideInstance.runPythonAsync(`plot_img_b64(y_noise, "Original Corrupted Signal", "#6c757d")`);
        
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
            document.getElementById('code-editor').value = algoPresets[e.target.value];
            document.getElementById('processed-plot-img').style.display = 'none';
            document.getElementById('proc-placeholder').style.display = 'block';
        });
    }

    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            if (!pyodideInstance) return;
            
            runBtn.disabled = true;
            runBtn.innerText = '正在运行计算...';
            runBtn.style.opacity = '0.7';
            
            const code = document.getElementById('code-editor').value;
            
            const wrapper = `
try:
${code.split('\n').map(line => '    ' + line).join('\n')}
    _result_base64_ = plot_img_b64(y_processed, "Processed Signal", "#0d6efd")
    _result_base64_
except Exception as e:
    str(e)
`;
            try {
                const res = await pyodideInstance.runPythonAsync(wrapper);
                if (res && res.startsWith('iVBOR')) { 
                    document.getElementById('proc-placeholder').style.display = 'none';
                    const procImg = document.getElementById('processed-plot-img');
                    procImg.src = "data:image/png;base64," + res;
                    procImg.style.display = 'block';
                } else {
                    alert("运行时出错，检查是否缺少 y_processed 变量?\\nPython 报错: " + res);
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