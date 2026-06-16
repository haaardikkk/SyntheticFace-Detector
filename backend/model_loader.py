import torch
from torchvision import models

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def load_model(model_path="best_model_v2.pth"):
    model = models.efficientnet_b0(weights=None)

    model.classifier[1] = torch.nn.Linear(
        model.classifier[1].in_features,
        2
    )

    model.load_state_dict(
        torch.load(
            model_path,
            map_location=DEVICE
        )
    )

    model.to(DEVICE)
    model.eval()

    return model

model = load_model()