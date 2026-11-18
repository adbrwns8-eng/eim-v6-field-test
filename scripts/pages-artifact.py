"""Stage committed frontend blobs; verify a Pages tar without extraction or execution."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import tarfile

FILES = (
    'app-v10.js', 'app-v11.js', 'app-v12.js', 'corrective.html', 'documents.html',
    'index.html', 'inspection.html', 'manager.html', 'morning-v2.js',
    'onboarding-pilot.css', 'onboarding-pilot.html', 'onboarding-pilot.js',
    'tab-sync.js', 'training.html', 'verify.html', 'welcome.html',
)
MANIFEST = 'release-manifest.json'
MAX_SIZE = 5 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError('Release blocked: ' + message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def revision(sha):
    require(bool(re.fullmatch('[0-9a-f]{40}', sha)), 'full lowercase commit SHA required')


def git(source, *args):
    return subprocess.check_output(['git', '-C', str(source), *args])


def stage(source, sha, output):
    revision(sha)
    require(git(source, 'rev-parse', 'HEAD').decode().strip() == sha, 'source checkout differs from approved SHA')
    data = {}
    for name in FILES:
        entry = git(source, 'ls-tree', sha, '--', name).decode().strip()
        require(entry.startswith('100644 blob ') and entry.endswith('\t' + name), 'missing, executable or symlink frontend asset: ' + name)
        data[name] = git(source, 'show', sha + ':' + name)
        require(len(data[name]) <= MAX_SIZE, 'oversized frontend asset')
    manifest = json.dumps({'schema': 1, 'revision': sha, 'files': {
        name: sha256(content) for name, content in data.items()
    }}, sort_keys=True, separators=(',', ':')).encode()
    data[MANIFEST] = manifest
    # Never include checkout metadata, tests, dependencies, backend files or links.
    with tarfile.open(output, 'w', format=tarfile.USTAR_FORMAT) as archive:
        for name, content in sorted(data.items()):
            info = tarfile.TarInfo(name)
            info.size = len(content)
            info.mode = 0o644
            info.mtime = 0
            archive.addfile(info, io.BytesIO(content))
    return sha256(manifest)


def verify(artifact, sha, digest):
    revision(sha)
    require(bool(re.fullmatch('[0-9a-f]{64}', digest)), 'manifest digest required')
    require(Path(artifact).stat().st_size <= (len(FILES) + 2) * (MAX_SIZE + 1024), 'oversized archive')
    with tarfile.open(artifact, 'r:') as archive:
        entries = archive.getmembers()
        names = [entry.name for entry in entries]
        require(len(names) == len(set(names)) and set(names) == set(FILES) | {MANIFEST}, 'unexpected, missing or duplicate archive paths')
        require(all(entry.isfile() and 0 <= entry.size <= MAX_SIZE for entry in entries), 'links, special files or oversized entries forbidden')
        manifest = archive.extractfile(MANIFEST).read()
        require(sha256(manifest) == digest, 'manifest digest mismatch')
        document = json.loads(manifest)
        require(document.get('schema') == 1 and document.get('revision') == sha, 'artifact revision mismatch')
        require(set(document.get('files', {})) == set(FILES), 'manifest file allowlist mismatch')
        for name in FILES:
            require(sha256(archive.extractfile(name).read()) == document['files'][name], 'asset digest mismatch: ' + name)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['stage', 'verify'])
    parser.add_argument('--sha', required=True)
    parser.add_argument('--artifact', required=True)
    parser.add_argument('--source')
    parser.add_argument('--digest')
    args = parser.parse_args()
    if args.operation == 'stage':
        require(args.source is not None, 'source repository required')
        print(stage(args.source, args.sha, args.artifact))
    else:
        verify(args.artifact, args.sha, args.digest or '')
        print('Verified exact approved revision and all frontend asset digests')
