import tensorflow_hub as hub
import soundfile as sf
import numpy as np
import json
import sys

GAME_EVENTS = {
  67: 'gunshot',
  366: 'explosion',
  389: 'crowd_cheering',
  63: 'gunfire_burst',
}

def cluster_events(events, gap=1.5):
  if not events:
    return []

  events = sorted(events, key=lambda x: x['time'])
  clusters = []
  current_cluster = [events[0]]

  for i in range(1, len(events)):
    if events[i]['time'] - events[i - 1]['time'] <= gap:
      current_cluster.append(events[i])
    else:
      max_conf = max(e['confidence'] for e in current_cluster)
      first_time = current_cluster[0]['time']
      clusters.append({
        'time': first_time,
        'event': current_cluster[0]['event'],
        'confidence': max_conf,
      })
      current_cluster = [events[i]]

  if current_cluster:
    max_conf = max(e['confidence'] for e in current_cluster)
    first_time = current_cluster[0]['time']
    clusters.append({
      'time': first_time,
      'event': current_cluster[0]['event'],
      'confidence': max_conf,
    })

  return clusters

def detect_events(audio_path, threshold=0.30):
  model = hub.load('https://tfhub.dev/google/yamnet/1')
  wav, sr = sf.read(audio_path, dtype='float32')

  if sr != 16000:
    import warnings
    warnings.warn(f'Audio sample rate is {sr} Hz, expected 16000 Hz for YAMNet')

  scores, _, _ = model(wav)
  events = []

  for i, frame in enumerate(scores.numpy()):
    for cid, label in GAME_EVENTS.items():
      if frame[cid] > threshold:
        events.append({
          'time': round(i * 0.48, 2),
          'event': label,
          'confidence': float(frame[cid]),
        })

  return cluster_events(events, gap=1.5)

if __name__ == '__main__':
  if len(sys.argv) < 2:
    print(json.dumps({'error': 'Usage: python detect_events.py <audio_path> [threshold]'}))
    sys.exit(1)

  audio_path = sys.argv[1]
  threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.30

  try:
    result = detect_events(audio_path, threshold)
    print(json.dumps(result))
  except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)
