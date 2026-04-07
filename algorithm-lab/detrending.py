# 去趋势算法 (Detrending)
# 消除光谱内的多项式漂移
import numpy as np
from scipy import signal

# y_noise 为当前加载的信号
# t 为横轴坐标

# 您可以使用 scipy.signal.detrend 或者自己写的多项式拟合相减
y_processed = signal.detrend(y_noise) # 您可以在这里扩展