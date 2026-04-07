# 基线校正 (Baseline Correction)
# 常见的有 ALS, modpoly, airPLS 等
# 请在这里编写您的算法代码
import numpy as np

# y_noise 为当前加载的带基线漂移信号
# t 为横轴坐标 / 波数
# 输出必须将结果赋值给 y_processed

y_processed = y_noise # 替换为您的基线校正逻辑