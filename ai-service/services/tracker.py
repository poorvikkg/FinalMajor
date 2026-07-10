import numpy as np
from scipy.spatial.distance import cdist
import lap

class Tracker:
    def __init__(self, max_age=30, max_iou_distance=0.7):
        self.max_age = max_age
        self.max_iou_distance = max_iou_distance
        self.tracks = []
        self.next_id = 1

    def update(self, detections):
        """
        Update tracker with new detections.
        detections: list of dicts with 'bbox' (x1,y1,x2,y2) and optionally 'face_id'.
        Returns a list of updated tracks.
        """
        if len(detections) == 0:
            for t in self.tracks:
                t['age'] += 1
            self.tracks = [t for t in self.tracks if t['age'] <= self.max_age]
            return self.tracks

        if len(self.tracks) == 0:
            for det in detections:
                self.tracks.append({
                    'id': self.next_id,
                    'bbox': det['bbox'],
                    'face_id': det.get('face_id'), # MongoDB ID if recognized
                    'age': 0
                })
                self.next_id += 1
            return self.tracks

        # Compute IoU cost matrix
        track_bboxes = np.array([t['bbox'] for t in self.tracks])
        det_bboxes = np.array([d['bbox'] for d in detections])
        
        cost_matrix = self._iou_distance(track_bboxes, det_bboxes)
        
        # Hungarian assignment
        cost, x, y = lap.lapjv(cost_matrix, extend_cost=True, cost_limit=self.max_iou_distance)
        
        matched_indices = []
        unmatched_tracks = []
        unmatched_detections = []
        
        for t, d in enumerate(x):
            if d >= 0:
                matched_indices.append((t, d))
            else:
                unmatched_tracks.append(t)
                
        for d, t in enumerate(y):
            if t < 0:
                unmatched_detections.append(d)

        # Update matched tracks
        for t_idx, d_idx in matched_indices:
            self.tracks[t_idx]['bbox'] = detections[d_idx]['bbox']
            self.tracks[t_idx]['age'] = 0
            # If the detection has a recognized face_id, update it
            if detections[d_idx].get('face_id'):
                self.tracks[t_idx]['face_id'] = detections[d_idx]['face_id']
                
        # Age unmatched tracks
        for t_idx in unmatched_tracks:
            self.tracks[t_idx]['age'] += 1
            
        # Remove old tracks
        self.tracks = [t for t in self.tracks if t['age'] <= self.max_age]
        
        # Add new tracks
        for d_idx in unmatched_detections:
            self.tracks.append({
                'id': self.next_id,
                'bbox': detections[d_idx]['bbox'],
                'face_id': detections[d_idx].get('face_id'),
                'age': 0
            })
            self.next_id += 1
            
        return self.tracks

    def _iou_distance(self, atracks, btracks):
        """
        Compute cost based on IoU
        """
        if (atracks.size == 0) or (btracks.size == 0):
            return np.empty((atracks.shape[0], btracks.shape[0]))

        # Calculate areas
        area_a = (atracks[:, 2] - atracks[:, 0]) * (atracks[:, 3] - atracks[:, 1])
        area_b = (btracks[:, 2] - btracks[:, 0]) * (btracks[:, 3] - btracks[:, 1])

        # Expand dims for broadcasting
        top_left = np.maximum(atracks[:, None, :2], btracks[None, :, :2])
        bottom_right = np.minimum(atracks[:, None, 2:], btracks[None, :, 2:])

        wh = np.maximum(0.0, bottom_right - top_left)
        intersection = wh[:, :, 0] * wh[:, :, 1]
        
        union = area_a[:, None] + area_b[None, :] - intersection
        
        iou = intersection / np.maximum(union, 1e-6)
        return 1.0 - iou

tracker = Tracker()
