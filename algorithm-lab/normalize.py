# 数据归一化 (Normalization)
import numpy as np
from common import zscore_normalize

# 常见的有 Min-Max 或 Z-score (Standard Normal Variate, SNV)
y_processed = zscore_normalize(y_noise)

