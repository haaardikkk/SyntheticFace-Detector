import cv2

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades +
    "haarcascade_frontalface_default.xml"
)

def crop_largest_face(image):

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_RGB2GRAY
    )

    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(50, 50)
    )

    if len(faces) == 0:
        return image

    largest = max(
        faces,
        key=lambda f: f[2] * f[3]
    )

    x, y, w, h = largest

    padding = int(0.2 * w)

    x1 = max(0, x - padding)
    y1 = max(0, y - padding)

    x2 = min(image.shape[1], x + w + padding)
    y2 = min(image.shape[0], y + h + padding)

    return image[y1:y2, x1:x2]