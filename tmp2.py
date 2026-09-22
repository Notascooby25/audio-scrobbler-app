import re
with open('backend/app/services/spotify_library_service.py', 'r') as f:
    content = f.read()

content = re.sub(r'def find_pending_playlist_uris.*?(?=\n\n\ndef )', '', content, flags=re.DOTALL)
content = re.sub(r'def upsert_playlist_cache.*?(?=\n\n\ndef )', '', content, flags=re.DOTALL)

with open('backend/app/services/spotify_library_service.py', 'w') as f:
    f.write(content)
