const REJECTION_MESSAGES = {
  no_face:         "We couldn't find a face in this photo. Please retake with your face clearly visible.",
  multiple_faces:  "We can only analyse one face at a time. Please retake with just yourself in frame.",
  face_too_small:  "Your face is too far from the camera. Please retake from closer.",
  poor_quality:    "The photo is too dark or blurry to analyse. Please retake in better lighting.",
  heavy_makeup:    "Makeup is covering too much of your skin to analyse accurately. For best results, retake with minimal or no makeup.",
  not_real_photo:  "Please use a real photo of your face — drawings and filtered images can't be analysed.",
};

module.exports = { REJECTION_MESSAGES };