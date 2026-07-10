import cv2
import numpy as np
from services.model_manager import model_manager
from config.settings import settings
from services.logger import sys_logger, err_logger

class FaceDetector:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(FaceDetector, cls).__new__(cls)
        return cls._instance

    @property
    def session(self):
        try:
            return model_manager.get_session("detector")
        except ValueError:
            return None

    def detect(self, img: np.ndarray, threshold: float = settings.DETECTION_THRESHOLD):
        sess = self.session
        if sess is None:
            err_logger.error("Detector session is None. Cannot detect faces.")
            raise ValueError("Detector ONNX model not loaded.")

        h, w = img.shape[:2]
        max_size = 640
        im_ratio = float(img.shape[0]) / img.shape[1]
        if im_ratio > 1:
            new_height = max_size
            new_width = int(new_height / im_ratio)
        else:
            new_width = max_size
            new_height = int(new_width * im_ratio)
            
        resized_img = cv2.resize(img, (new_width, new_height))
        det_img = np.zeros((max_size, max_size, 3), dtype=np.uint8)
        det_img[:new_height, :new_width, :] = resized_img
        
        blob = cv2.dnn.blobFromImage(det_img, 1.0/128, (max_size, max_size), (127.5, 127.5, 127.5), swapRB=True)
        
        input_name = sess.get_inputs()[0].name
        net_outs = sess.run(None, {input_name: blob})
        
        # Decode SCRFD outputs
        # Usually 9 outputs: 3 strides (8, 16, 32) x (score, bbox, kps)
        # We need to sort them or identify them. Usually they are grouped by stride.
        # But without knowing the exact output order of this specific ONNX, 
        # a robust way is to group them by shape.
        
        scores_list = []
        bboxes_list = []
        kpss_list = []
        
        # Identify tensors by their last dimension
        for out in net_outs:
            if out.shape[-1] == 1:
                scores_list.append(out)
            elif out.shape[-1] == 4:
                bboxes_list.append(out)
            elif out.shape[-1] == 10:
                kpss_list.append(out)
                
        # Sort them by spatial size (descending -> stride 8, 16, 32)
        scores_list.sort(key=lambda x: x.shape[1], reverse=True)
        bboxes_list.sort(key=lambda x: x.shape[1], reverse=True)
        kpss_list.sort(key=lambda x: x.shape[1], reverse=True)
        
        featmap_sizes = [(int(max_size/8), int(max_size/8)), 
                         (int(max_size/16), int(max_size/16)), 
                         (int(max_size/32), int(max_size/32))]
        strides = [8, 16, 32]
        
        det_bboxes = []
        det_kpss = []
        det_scores = []
        
        for idx, stride in enumerate(strides):
            scores = scores_list[idx] # (N, 1)
            bboxes = bboxes_list[idx] # (N, 4)
            kpss = kpss_list[idx]     # (N, 10)
            
            # Filter by threshold early
            mask = (scores >= threshold).flatten()
            if not mask.any():
                continue
                
            scores = scores[mask]
            bboxes = bboxes[mask]
            kpss = kpss[mask]
            
            # Generate anchors for this stride
            height, width = featmap_sizes[idx]
            y, x = np.mgrid[0:height, 0:width]
            y = (y.astype(np.float32) * stride).flatten()
            x = (x.astype(np.float32) * stride).flatten()
            anchor_centers = np.stack([x, y], axis=-1)
            anchor_centers = np.repeat(anchor_centers, 2, axis=0) # num_anchors=2
            
            # Apply mask to anchors too
            anchor_centers = anchor_centers[mask]
            
            # distance2bbox
            x1 = anchor_centers[:, 0] - bboxes[:, 0] * stride
            y1 = anchor_centers[:, 1] - bboxes[:, 1] * stride
            x2 = anchor_centers[:, 0] + bboxes[:, 2] * stride
            y2 = anchor_centers[:, 1] + bboxes[:, 3] * stride
            pred_bboxes = np.stack([x1, y1, x2, y2], axis=-1)
            
            # distance2kps
            pred_kpss = []
            for i in range(5):
                px = anchor_centers[:, 0] + kpss[:, i*2] * stride
                py = anchor_centers[:, 1] + kpss[:, i*2+1] * stride
                pred_kpss.append(px)
                pred_kpss.append(py)
            pred_kpss = np.stack(pred_kpss, axis=-1).reshape(-1, 5, 2)
            
            det_bboxes.append(pred_bboxes)
            det_kpss.append(pred_kpss)
            det_scores.append(scores)
            
        if len(det_bboxes) == 0:
            return np.array([]), np.array([])
            
        det_bboxes = np.vstack(det_bboxes)
        det_kpss = np.vstack(det_kpss)
        det_scores = np.vstack(det_scores)
        
        # Scale coordinates back to original image
        scale = im_ratio if im_ratio > 1 else 1 / im_ratio
        det_bboxes = det_bboxes / (new_width / w)
        det_kpss = det_kpss / (new_width / w)
        
        # NMS
        keep = cv2.dnn.NMSBoxes(det_bboxes.tolist(), det_scores.flatten().tolist(), threshold, 0.4)
        if len(keep) == 0:
            return np.array([]), np.array([])
            
        keep = keep.flatten()
        final_bboxes = det_bboxes[keep]
        final_scores = det_scores[keep]
        final_kpss = det_kpss[keep]
        
        # Combine bboxes and scores: [x1, y1, x2, y2, score]
        final_bboxes = np.hstack([final_bboxes, final_scores])
        
        sys_logger.debug(f"Detected {len(final_bboxes)} faces.")
        
        if getattr(settings, 'DEBUG', False):
            import os
            debug_dir = os.path.join(settings.BASE_DIR, "logs", "debug")
            os.makedirs(debug_dir, exist_ok=True)
            
            # Save original
            cv2.imwrite(os.path.join(debug_dir, "1_original.jpg"), img)
            
            # Save resized
            cv2.imwrite(os.path.join(debug_dir, "2_resized.jpg"), resized_img)
            
            # Bboxes before NMS
            img_before_nms = img.copy()
            for b in det_bboxes:
                x1, y1, x2, y2 = b[:4].astype(int)
                cv2.rectangle(img_before_nms, (x1, y1), (x2, y2), (0, 0, 255), 1)
            cv2.imwrite(os.path.join(debug_dir, "3_before_nms.jpg"), img_before_nms)
            
            # Final detection image
            img_final = img.copy()
            for b, kps in zip(final_bboxes, final_kpss):
                x1, y1, x2, y2 = b[:4].astype(int)
                cv2.rectangle(img_final, (x1, y1), (x2, y2), (0, 255, 0), 2)
                for i in range(5):
                    cx, cy = kps[i].astype(int)
                    cv2.circle(img_final, (cx, cy), 2, (255, 0, 0), -1)
            cv2.imwrite(os.path.join(debug_dir, "4_final_detection.jpg"), img_final)
            
        return final_bboxes, final_kpss

detector = FaceDetector()


