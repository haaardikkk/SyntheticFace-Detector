"""Detector architecture. The training notebook embeds this file unchanged.

One backbone, two outputs:
  * logit: is this face real or AI-made/altered? (> 0 = fake)
  * mask:  one logit per region at 1/4 of the input resolution: where was it altered?
"""
import timm
import torch.nn as nn
import torch.nn.functional as F


class SyntheticFaceNet(nn.Module):
    def __init__(self, backbone="convnext_tiny.fb_in22k_ft_in1k", pretrained=False, fpn_dim=128, dropout=0.2, drop_path_rate=0.0):
        super().__init__()
        self.backbone = timm.create_model(
            backbone, pretrained=pretrained, features_only=True, out_indices=(0, 1, 2, 3), drop_path_rate=drop_path_rate
        )
        channels = self.backbone.feature_info.channels()
        self.classifier = nn.Sequential(
            nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.LayerNorm(channels[-1]), nn.Dropout(dropout), nn.Linear(channels[-1], 1)
        )
        self.lateral = nn.ModuleList(nn.Conv2d(c, fpn_dim, 1) for c in channels)
        self.mask_head = nn.Sequential(
            nn.Conv2d(fpn_dim, fpn_dim, 3, padding=1), nn.GroupNorm(8, fpn_dim), nn.GELU(), nn.Conv2d(fpn_dim, 1, 1)
        )

    def forward(self, x):
        features = self.backbone(x)
        logit = self.classifier(features[-1]).squeeze(1)
        y = self.lateral[-1](features[-1])
        for lateral, feature in zip(reversed(self.lateral[:-1]), reversed(features[:-1])):
            y = lateral(feature) + F.interpolate(y, size=feature.shape[-2:], mode="bilinear", align_corners=False)
        return logit, self.mask_head(y)
