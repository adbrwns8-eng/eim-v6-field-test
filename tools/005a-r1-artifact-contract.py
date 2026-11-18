"""Offline structural diagnostic of PR #7's exact packager. No service or credential use."""
import importlib.util
import io
from pathlib import Path
import subprocess
import tarfile
import tempfile
import zipfile

SHA = '660d9c3b06aa0bbdb1295519747a88ac140f47e7'
REPOSITORY = Path(__file__).resolve().parents[1]


def git(*args, cwd=REPOSITORY):
    return subprocess.check_output(['git', '-C', str(cwd), *args], stderr=subprocess.DEVNULL)


assert git('rev-parse', '--verify', SHA + '^{commit}').decode().strip() == SHA
with tempfile.TemporaryDirectory() as temporary:
    root = Path(temporary)
    module_path = root / 'reviewed-packager.py'
    module_path.write_bytes(git('show', SHA + ':scripts/pages-artifact.py'))
    spec = importlib.util.spec_from_file_location('reviewed_packager', module_path)
    packager = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(packager)
    source = root / 'synthetic-repo'
    source.mkdir()
    git('init', '--quiet', cwd=source)
    git('config', 'user.name', 'Offline Contract Test', cwd=source)
    git('config', 'user.email', 'contract@example.invalid', cwd=source)
    for name in packager.FILES:
        (source / name).write_text('synthetic content: ' + name)
    git('add', '.', cwd=source)
    git('commit', '--quiet', '-m', 'synthetic fixture', cwd=source)
    revision = git('rev-parse', 'HEAD', cwd=source).decode().strip()
    archive = root / 'artifact.tar'
    digest = packager.stage(source, revision, archive)
    packager.verify(archive, revision, digest)
    raw = archive.read_bytes()
    assert raw[:2] != b'\x1f\x8b', 'Pinned official action builds raw tar; do not assume inner gzip'
    assert raw[257:262] == b'ustar'
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:') as tar:
        members = tar.getmembers()
        assert all(entry.isfile() and not entry.issym() and not entry.islnk() for entry in members)
        assert all(entry.mode & 0o444 == 0o444 for entry in members)
        assert set(tar.getnames()) == set(packager.FILES) | {packager.MANIFEST}
        assert len(members) == 17
    # Model upload-artifact's documented ZIP transport, not the actual remote service.
    wrapper = root / 'synthetic-transport.zip'
    with zipfile.ZipFile(wrapper, 'w', compression=zipfile.ZIP_DEFLATED) as zipped:
        zipped.write(archive, 'artifact.tar')
    with zipfile.ZipFile(wrapper) as zipped:
        assert zipped.namelist() == ['artifact.tar']
        assert zipped.read('artifact.tar') == raw
    print('PASS: committed synthetic assets -> raw USTAR artifact.tar; 17 regular readable members; hashes/revision verified.')
    print('PASS: modeled ZIP transport contains only artifact.tar and preserves its bytes.')
    print('UNVERIFIED: actual Actions upload/download service, Pages backend acceptance, OIDC and approval behavior. No dispatch/deploy occurred.')
