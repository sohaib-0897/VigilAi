import threading
import time
from collections import deque

import numpy as np
import scipy.linalg
from scipy.optimize import linear_sum_assignment

from ..detection.models import BBox, Detection
from .base import BaseTracker
from .models import Track, TrackingResult


class KalmanFilter:
    def __init__(self):
        ndim, dt = 4, 1.0
        self._motion_mat = np.eye(2 * ndim, 2 * ndim)
        for i in range(ndim):
            self._motion_mat[i, ndim + i] = dt
        self._update_mat = np.eye(ndim, 2 * ndim)
        self._std_weight_position = 1.0 / 20
        self._std_weight_velocity = 1.0 / 160

    def initiate(self, measurement):
        mean_pos = measurement
        mean_vel = np.zeros_like(mean_pos)
        mean = np.r_[mean_pos, mean_vel]
        std = [
            2 * self._std_weight_position * measurement[3],
            2 * self._std_weight_position * measurement[3],
            1e-2,
            2 * self._std_weight_position * measurement[3],
            10 * self._std_weight_velocity * measurement[3],
            10 * self._std_weight_velocity * measurement[3],
            1e-5,
            10 * self._std_weight_velocity * measurement[3],
        ]
        covariance = np.diag(np.square(std))
        return mean, covariance

    def predict(self, mean, covariance):
        std_pos = [
            self._std_weight_position * mean[3],
            self._std_weight_position * mean[3],
            1e-2,
            self._std_weight_position * mean[3],
        ]
        std_vel = [
            self._std_weight_velocity * mean[3],
            self._std_weight_velocity * mean[3],
            1e-5,
            self._std_weight_velocity * mean[3],
        ]
        motion_cov = np.diag(np.square(np.r_[std_pos, std_vel]))
        mean = np.dot(self._motion_mat, mean)
        covariance = (
            np.linalg.multi_dot((self._motion_mat, covariance, self._motion_mat.T)) + motion_cov
        )
        return mean, covariance

    def project(self, mean, covariance):
        std = [
            self._std_weight_position * mean[3],
            self._std_weight_position * mean[3],
            1e-1,
            self._std_weight_position * mean[3],
        ]
        innovation_cov = np.diag(np.square(std))
        mean = np.dot(self._update_mat, mean)
        covariance = (
            np.linalg.multi_dot((self._update_mat, covariance, self._update_mat.T)) + innovation_cov
        )
        return mean, covariance

    def update(self, mean, covariance, measurement):
        projected_mean, projected_cov = self.project(mean, covariance)
        chol_factor, lower = scipy.linalg.cho_factor(projected_cov, lower=True, check_finite=False)
        kalman_gain = scipy.linalg.cho_solve(
            (chol_factor, lower), np.dot(covariance, self._update_mat.T).T, check_finite=False
        ).T
        innovation = measurement - projected_mean
        new_mean = mean + np.dot(innovation, kalman_gain.T)
        new_covariance = covariance - np.linalg.multi_dot(
            (kalman_gain, projected_cov, kalman_gain.T)
        )
        return new_mean, new_covariance


class STrack:
    shared_kalman = KalmanFilter()

    def __init__(self, tlwh, score, class_id, class_name):
        self._tlwh = np.asarray(tlwh, dtype=np.float32)
        self.kalman_filter = None
        self.mean, self.covariance = None, None
        self.is_activated = False
        self.score = score
        self.track_id = 0
        self.state = "New"
        self.class_id = class_id
        self.class_name = class_name
        self.frame_id = 0
        self.start_frame = 0
        self.trajectory = deque(maxlen=100)
        self.age = 0
        self.first_seen = time.time()
        self.last_seen = self.first_seen

    def predict(self):
        mean_state = self.mean.copy()
        if self.state != "Tracked":
            mean_state[7] = 0
        self.mean, self.covariance = self.shared_kalman.predict(mean_state, self.covariance)

    def activate(self, kalman_filter, frame_id, track_id):
        self.kalman_filter = kalman_filter
        self.track_id = track_id
        self.mean, self.covariance = self.kalman_filter.initiate(self.tlwh_to_xyah(self._tlwh))
        self.state = "Tracked"
        self.is_activated = True
        self.frame_id = frame_id
        self.start_frame = frame_id
        self._update_trajectory()

    def re_activate(self, new_track, frame_id, new_id=False):
        self.mean, self.covariance = self.shared_kalman.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        self.state = "Tracked"
        self.is_activated = True
        self.score = new_track.score
        self.frame_id = frame_id
        self.last_seen = time.time()
        self.age += 1
        self._update_trajectory()

    def update(self, new_track, frame_id):
        self.frame_id = frame_id
        self.age += 1
        self.last_seen = time.time()
        self.mean, self.covariance = self.shared_kalman.update(
            self.mean, self.covariance, self.tlwh_to_xyah(new_track.tlwh)
        )
        self.state = "Tracked"
        self.is_activated = True
        self.score = new_track.score
        self._update_trajectory()

    def mark_lost(self):
        self.state = "Lost"

    def mark_removed(self):
        self.state = "Removed"

    def _update_trajectory(self):
        cx = self.tlwh[0] + self.tlwh[2] / 2
        cy = self.tlwh[1] + self.tlwh[3] / 2
        self.trajectory.append((float(cx), float(cy)))

    @property
    def tlwh(self):
        if self.mean is None:
            return self._tlwh.copy()
        ret = self.mean[:4].copy()
        ret[2] *= ret[3]
        ret[:2] -= ret[2:] / 2
        return ret

    @property
    def tlbr(self):
        ret = self.tlwh.copy()
        ret[2:] += ret[:2]
        return ret

    @staticmethod
    def tlwh_to_xyah(tlwh):
        ret = np.asarray(tlwh).copy()
        ret[:2] += ret[2:] / 2
        ret[2] /= ret[3]
        return ret


def iou_distance(atracks, btracks):
    if (len(atracks) > 0 and isinstance(atracks[0], np.ndarray)) or (
        len(btracks) > 0 and isinstance(btracks[0], np.ndarray)
    ):
        atlbrs = atracks
        btlbrs = btracks
    else:
        atlbrs = [track.tlbr for track in atracks]
        btlbrs = [track.tlbr for track in btracks]
    _ious = np.zeros((len(atlbrs), len(btlbrs)), dtype=np.float32)
    if _ious.size == 0:
        return _ious

    for i, a in enumerate(atlbrs):
        for j, b in enumerate(btlbrs):
            if hasattr(atracks[i], "class_id") and atracks[i].class_id != btracks[j].class_id:
                continue
            x1 = max(a[0], b[0])
            y1 = max(a[1], b[1])
            x2 = min(a[2], b[2])
            y2 = min(a[3], b[3])
            w = max(0, x2 - x1)
            h = max(0, y2 - y1)
            inter = w * h
            area_a = (a[2] - a[0]) * (a[3] - a[1])
            area_b = (b[2] - b[0]) * (b[3] - b[1])
            iou = inter / (area_a + area_b - inter + 1e-6)
            _ious[i, j] = 1 - iou
    return _ious


def linear_assignment(cost_matrix, thresh):
    if cost_matrix.size == 0:
        return (
            np.empty((0, 2), dtype=int),
            tuple(range(cost_matrix.shape[0])),
            tuple(range(cost_matrix.shape[1])),
        )
    matches, unmatched_a, unmatched_b = [], [], []
    cost_matrix = np.where(cost_matrix > thresh, thresh + 1e-4, cost_matrix)
    row_ind, col_ind = linear_sum_assignment(cost_matrix)

    for i in range(cost_matrix.shape[0]):
        if i not in row_ind:
            unmatched_a.append(i)
    for j in range(cost_matrix.shape[1]):
        if j not in col_ind:
            unmatched_b.append(j)

    for r, c in zip(row_ind, col_ind):
        if cost_matrix[r, c] > thresh:
            unmatched_a.append(r)
            unmatched_b.append(c)
        else:
            matches.append([r, c])

    return np.array(matches), unmatched_a, unmatched_b


class ByteTrackTracker(BaseTracker):
    def __init__(self, track_thresh=0.5, track_buffer=30, match_thresh=0.8):
        self.track_thresh = track_thresh
        self.track_buffer = track_buffer
        self.match_thresh = match_thresh

        self.tracked_stracks = []
        self.lost_stracks = []
        self.removed_stracks = []

        self.frame_id = 0
        self._next_id = 1
        self._total_created = 0
        self.kalman_filter = KalmanFilter()
        self._lock = threading.Lock()

    def update(
        self, detections: list[Detection], frame: np.ndarray | None = None
    ) -> TrackingResult:
        with self._lock:
            start_t = time.perf_counter()
            self.frame_id += 1

            activated_stracks = []
            refind_stracks = []
            lost_stracks = []
            removed_stracks = []

            scores = np.array([d.confidence for d in detections]) if detections else np.array([])
            bboxes = (
                np.array([[d.bbox.x1, d.bbox.y1, d.bbox.width, d.bbox.height] for d in detections])
                if detections
                else np.array([])
            )
            classes = np.array([d.class_id for d in detections]) if detections else np.array([])
            class_names = [d.class_name for d in detections]

            if len(scores) > 0:
                remain_inds = scores >= self.track_thresh
                inds_low = scores > 0.1
                inds_high = scores < self.track_thresh
                inds_second = np.logical_and(inds_low, inds_high)

                dets_first = bboxes[remain_inds]
                scores_first = scores[remain_inds]
                classes_first = classes[remain_inds]
                names_first = [class_names[i] for i, v in enumerate(remain_inds) if v]

                dets_second = bboxes[inds_second]
                scores_second = scores[inds_second]
                classes_second = classes[inds_second]
                names_second = [class_names[i] for i, v in enumerate(inds_second) if v]
            else:
                dets_first = np.array([])
                scores_first = np.array([])
                classes_first = np.array([])
                names_first = []
                dets_second = np.array([])
                scores_second = np.array([])
                classes_second = np.array([])
                names_second = []

            detections_first = [
                STrack(tlwh, s, c, n)
                for tlwh, s, c, n in zip(dets_first, scores_first, classes_first, names_first)
            ]
            detections_second = [
                STrack(tlwh, s, c, n)
                for tlwh, s, c, n in zip(dets_second, scores_second, classes_second, names_second)
            ]

            unconfirmed = []
            tracked_stracks = []
            for track in self.tracked_stracks:
                if not track.is_activated:
                    unconfirmed.append(track)
                else:
                    tracked_stracks.append(track)

            strack_pool = tracked_stracks + self.lost_stracks
            for strack in strack_pool:
                strack.predict()

            dists = iou_distance(strack_pool, detections_first)
            matches, u_track, u_detection = linear_assignment(dists, thresh=self.match_thresh)

            for itracked, idet in matches:
                track = strack_pool[itracked]
                det = detections_first[idet]
                if track.state == "Tracked":
                    track.update(det, self.frame_id)
                    activated_stracks.append(track)
                else:
                    track.re_activate(det, self.frame_id)
                    refind_stracks.append(track)

            r_tracked_stracks = [
                strack_pool[i] for i in u_track if strack_pool[i].state == "Tracked"
            ]
            dists = iou_distance(r_tracked_stracks, detections_second)
            matches, u_track_second, u_detection_second = linear_assignment(dists, thresh=0.5)

            for itracked, idet in matches:
                track = r_tracked_stracks[itracked]
                det = detections_second[idet]
                if track.state == "Tracked":
                    track.update(det, self.frame_id)
                    activated_stracks.append(track)
                else:
                    track.re_activate(det, self.frame_id)
                    refind_stracks.append(track)

            for it in u_track_second:
                track = r_tracked_stracks[it]
                if not track.state == "Lost":
                    track.mark_lost()
                    lost_stracks.append(track)

            detections_first_unmatched = [detections_first[i] for i in u_detection]
            dists = iou_distance(unconfirmed, detections_first_unmatched)
            matches, u_unconfirmed, u_detection = linear_assignment(dists, thresh=0.7)

            for itracked, idet in matches:
                unconfirmed[itracked].update(detections_first_unmatched[idet], self.frame_id)
                activated_stracks.append(unconfirmed[itracked])

            for it in u_unconfirmed:
                track = unconfirmed[it]
                track.mark_removed()
                removed_stracks.append(track)

            for inew in u_detection:
                track = detections_first_unmatched[inew]
                if track.score < self.track_thresh:
                    continue
                track.activate(self.kalman_filter, self.frame_id, self._next_id)
                self._next_id += 1
                self._total_created += 1
                activated_stracks.append(track)

            for track in self.lost_stracks:
                if self.frame_id - track.frame_id > self.track_buffer:
                    track.mark_removed()
                    removed_stracks.append(track)

            self.tracked_stracks = [t for t in self.tracked_stracks if t.state == "Tracked"]
            self.tracked_stracks = list(
                {
                    t.track_id: t for t in self.tracked_stracks + activated_stracks + refind_stracks
                }.values()
            )
            self.lost_stracks = (
                list(set(self.lost_stracks) - set(self.tracked_stracks)) + lost_stracks
            )
            self.lost_stracks = [t for t in self.lost_stracks if t.state == "Lost"]
            self.removed_stracks = removed_stracks
            self.tracked_stracks, self.lost_stracks = self._remove_duplicate_stracks(
                self.tracked_stracks, self.lost_stracks
            )

            out_tracks = []
            for track in self.tracked_stracks:
                if track.is_activated:
                    tlbr = track.tlbr
                    b = BBox(
                        x1=float(tlbr[0]), y1=float(tlbr[1]), x2=float(tlbr[2]), y2=float(tlbr[3])
                    )
                    cx, cy = b.center
                    out_tracks.append(
                        Track(
                            track_id=track.track_id,
                            class_id=track.class_id,
                            class_name=track.class_name,
                            bbox=b,
                            confidence=track.score,
                            centroid=(cx, cy),
                            first_seen=track.first_seen,
                            last_seen=track.last_seen,
                            age=track.age,
                            trajectory=track.trajectory,
                            is_confirmed=True,
                        )
                    )

            processing_time_ms = (time.perf_counter() - start_t) * 1000

            return TrackingResult(
                tracks=out_tracks,
                processing_time_ms=processing_time_ms,
                active_track_count=len(out_tracks),
                total_tracks_created=self._total_created,
            )

    def _remove_duplicate_stracks(self, stracksa, stracksb):
        pdist = iou_distance(stracksa, stracksb)
        pairs = np.where(pdist < 0.15)
        dupa, dupb = list(), list()
        for p, q in zip(*pairs):
            timep = stracksa[p].frame_id - stracksa[p].start_frame
            timeq = stracksb[q].frame_id - stracksb[q].start_frame
            if timep > timeq:
                dupb.append(q)
            else:
                dupa.append(p)
        resa = [t for i, t in enumerate(stracksa) if i not in dupa]
        resb = [t for i, t in enumerate(stracksb) if i not in dupb]
        return resa, resb

    def reset(self) -> None:
        with self._lock:
            self.tracked_stracks = []
            self.lost_stracks = []
            self.removed_stracks = []
            self.frame_id = 0
            self._next_id = 1
            self._total_created = 0

    @property
    def active_tracks(self) -> int:
        return len(self.tracked_stracks)

    @property
    def total_tracks_created(self) -> int:
        return self._total_created
