"""Offline artifact tests: synthetic files and temporary Git repositories only."""
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('pages_artifact', Path(__file__).resolve().parents[1] / 'scripts/pages-artifact.py')
artifact = importlib.util.module_from_spec(spec)
spec.loader.exec_module(artifact)
SHA = 'a' * 40


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.archive = self.root / 'artifact.tar'
        self.data = {name: ('synthetic ' + name).encode() for name in artifact.FILES}

    def make_tar(self, revision=SHA, transform=None, manifest_transform=None):
        manifest = {'schema': 1, 'revision': revision, 'files': {name: artifact.sha256(value) for name, value in self.data.items()}}
        if manifest_transform:
            manifest_transform(manifest)
        encoded = json.dumps(manifest, sort_keys=True).encode()
        entries = dict(self.data, **{artifact.MANIFEST: encoded})
        with tarfile.open(self.archive, 'w', format=tarfile.USTAR_FORMAT) as archive:
            for name, data in entries.items():
                info = tarfile.TarInfo(name)
                info.size = len(data)
                if transform:
                    info, data = transform(info, data)
                archive.addfile(info, io.BytesIO(data))
        return artifact.sha256(encoded)

    def test_valid_synthetic_artifact(self):
        digest = self.make_tar()
        artifact.verify(self.archive, SHA, digest)

    def test_wrong_sha(self):
        digest = self.make_tar(revision='b' * 40)
        with self.assertRaisesRegex(ValueError, 'revision mismatch'):
            artifact.verify(self.archive, SHA, digest)

    def test_manifest_tampered(self):
        self.make_tar()
        with self.assertRaisesRegex(ValueError, 'manifest digest mismatch'):
            artifact.verify(self.archive, SHA, '0' * 64)

    def test_asset_tampered(self):
        def tamper(info, data):
            return info, b'X' * len(data) if info.name == 'index.html' else data
        digest = self.make_tar(transform=tamper)
        with self.assertRaisesRegex(ValueError, 'asset digest mismatch'):
            artifact.verify(self.archive, SHA, digest)

    def test_symlink_forbidden(self):
        def link(info, data):
            if info.name == 'index.html':
                info.type, info.linkname, info.size = tarfile.SYMTYPE, '/etc/passwd', 0
            return info, data
        digest = self.make_tar(transform=link)
        with self.assertRaisesRegex(ValueError, 'links, special files'):
            artifact.verify(self.archive, SHA, digest)

    def test_traversal_and_unlisted_paths_forbidden(self):
        for bad_name in ['../index.html', '/index.html', 'supabase/secret.sql', '.git/config']:
            with self.subTest(path=bad_name):
                def rename(info, data):
                    if info.name == 'index.html':
                        info.name = bad_name
                    return info, data
                digest = self.make_tar(transform=rename)
                with self.assertRaisesRegex(ValueError, 'archive paths'):
                    artifact.verify(self.archive, SHA, digest)

    def test_duplicate_path_forbidden(self):
        digest = self.make_tar()
        with tarfile.open(self.archive, 'a') as archive:
            info = tarfile.TarInfo('index.html')
            archive.addfile(info, io.BytesIO(b''))
        with self.assertRaisesRegex(ValueError, 'archive paths'):
            artifact.verify(self.archive, SHA, digest)

    def test_manifest_allowlist_cannot_expand(self):
        digest = self.make_tar(manifest_transform=lambda m: m['files'].update({'secret': '0' * 64}))
        with self.assertRaisesRegex(ValueError, 'allowlist mismatch'):
            artifact.verify(self.archive, SHA, digest)

    def test_missing_or_malformed_sha_or_digest(self):
        digest = self.make_tar()
        for bad_sha in ['', 'main', SHA[:7], SHA + '\n']:
            with self.subTest(sha=bad_sha), self.assertRaises(ValueError):
                artifact.verify(self.archive, bad_sha, digest)
        for bad_digest in ['', '0' * 63, digest + '\n']:
            with self.subTest(digest=bad_digest), self.assertRaises(ValueError):
                artifact.verify(self.archive, SHA, bad_digest)

    def test_stage_reads_only_committed_allowlisted_blobs(self):
        source = self.root / 'repo'
        source.mkdir()
        def git(*args):
            return subprocess.check_output(['git', '-C', str(source), *args], stderr=subprocess.DEVNULL).decode().strip()
        git('init', '--quiet')
        git('config', 'user.name', 'Synthetic Test')
        git('config', 'user.email', 'synthetic@example.invalid')
        for name, data in self.data.items():
            (source / name).write_bytes(data)
        (source / 'backend.sql').write_text('SYNTHETIC NOT FOR PUBLISHING')
        git('add', '.')
        git('commit', '--quiet', '-m', 'synthetic assets')
        sha = git('rev-parse', 'HEAD')
        (source / 'index.html').write_text('uncommitted replacement')
        digest = artifact.stage(source, sha, self.archive)
        artifact.verify(self.archive, sha, digest)
        with tarfile.open(self.archive) as archive:
            self.assertNotIn('backend.sql', archive.getnames())
            self.assertEqual(archive.extractfile('index.html').read(), self.data['index.html'])
        before = self.archive.read_bytes()
        self.assertEqual(artifact.stage(source, sha, self.archive), digest)
        self.assertEqual(self.archive.read_bytes(), before)
        with self.assertRaisesRegex(ValueError, 'checkout differs'):
            artifact.stage(source, SHA, self.archive)
        (source / 'index.html').unlink()
        (source / 'index.html').symlink_to('backend.sql')
        git('add', 'index.html')
        git('commit', '--quiet', '-m', 'synthetic link')
        with self.assertRaisesRegex(ValueError, 'symlink frontend'):
            artifact.stage(source, git('rev-parse', 'HEAD'), self.archive)


if __name__ == '__main__':
    unittest.main(verbosity=2)
