import contextlib
import getpass
import importlib.util
import io
import os
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import warnings

module_path = Path(__file__).resolve().parent.parent / 'scripts/configure-google.py'
spec = importlib.util.spec_from_file_location('google_setup', module_path)
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)

CLIENT_ID = '123456789-fixture.apps.googleusercontent.com'
SECRET = 'GOCSPX-fixture_secret_123456789'
ORIGINAL = ('# preserved application settings\n'
            'APP_URL=https://blog.codelily.kr\n'
            'BETTER_AUTH_URL=https://blog.codelily.kr\n'
            'BETTER_AUTH_SECRET=fixture-auth\n'
            'OWNER_EMAILS=owner@example.invalid\n'
            'DATABASE_URL=fixture-database\n'
            'R2_SECRET_ACCESS_KEY=fixture-r2\n'
            'GOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n')


class GoogleSetupTests(unittest.TestCase):
    def test_invalid_credentials_never_appear_in_errors(self):
        for validator, value in [(setup.validate_client_id, 'fixture-private-id'),
                                 (setup.validate_secret, 'fixture private secret'),
                                 (setup.validate_secret, 'a' * 20 + '\nINJECTED=value'),
                                 (setup.validate_secret, 'a' * 20 + '$EXPANSION')]:
            with self.subTest(validator=validator.__name__):
                with self.assertRaises(setup.SetupError) as error:
                    validator(value)
                self.assertNotIn(value, str(error.exception))

    def test_hidden_input_retries_without_echo_and_fails_closed(self):
        with patch.object(getpass, 'getpass', side_effect=['bad secret', SECRET]):
            with contextlib.redirect_stderr(io.StringIO()) as output:
                self.assertEqual(setup.ask_hidden('Secret', setup.validate_secret), SECRET)
            self.assertNotIn('bad secret', output.getvalue())
            self.assertNotIn(SECRET, output.getvalue())
        def fallback(*args):
            warnings.warn('unavailable', getpass.GetPassWarning)
        with patch.object(getpass, 'getpass', side_effect=fallback):
            with self.assertRaises(getpass.GetPassWarning):
                setup.ask_hidden('Secret', setup.validate_secret)

    def test_wrong_origin_existing_keys_and_duplicates_are_rejected(self):
        for original in [ORIGINAL.replace('https://blog.codelily.kr', 'http://localhost:3000'),
                         ORIGINAL.replace('GOOGLE_CLIENT_ID=', 'GOOGLE_CLIENT_ID=' + CLIENT_ID),
                         ORIGINAL + 'GOOGLE_CLIENT_SECRET=\n',
                         ORIGINAL.replace('BETTER_AUTH_SECRET=fixture-auth', 'BETTER_AUTH_SECRET=')]:
            with self.assertRaises(setup.SetupError):
                setup.read_settings(original)

    def test_cli_rejects_arguments_and_noninteractive_input_before_prompting(self):
        with patch.object(setup, 'configure') as configure:
            with patch.object(setup.sys, 'argv', ['configure-google.py', SECRET]):
                with self.assertRaises(setup.SetupError):
                    setup.main()
            with patch.object(setup.sys, 'argv', ['configure-google.py']):
                with patch.object(setup.sys.stdin, 'isatty', return_value=False):
                    with self.assertRaises(setup.SetupError):
                        setup.main()
            configure.assert_not_called()

    @unittest.skipUnless(os.name == 'posix', 'Actual Linux file permissions/atomic replacement')
    def test_atomic_save_preserves_other_settings_and_private_backup(self):
        for omit_empty_keys in (False, True):
            with self.subTest(omit_empty_keys=omit_empty_keys), tempfile.TemporaryDirectory() as directory:
                env_file = Path(directory) / 'env/code-lily.env'
                env_file.parent.mkdir()
                original = ORIGINAL
                if omit_empty_keys:
                    original = original.replace('GOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n', '')
                env_file.write_text(original)
                with patch.object(getpass, 'getpass', side_effect=[CLIENT_ID, SECRET]):
                    with contextlib.redirect_stdout(io.StringIO()) as output:
                        setup.configure(env_file)
                saved = env_file.read_text()
                self.assertEqual(saved.replace('GOOGLE_CLIENT_ID=' + CLIENT_ID + '\n', '')
                                 .replace('GOOGLE_CLIENT_SECRET=' + SECRET + '\n', ''),
                                 original.replace('GOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\n', ''))
                self.assertEqual(env_file.with_name('code-lily.env.before-google').read_text(), original)
                for file in (env_file, env_file.with_name('code-lily.env.before-google')):
                    self.assertEqual(stat.S_IMODE(file.stat().st_mode), 0o600)
                self.assertEqual(stat.S_IMODE(env_file.parent.stat().st_mode), 0o700)
                self.assertNotIn(CLIENT_ID, output.getvalue())
                self.assertNotIn(SECRET, output.getvalue())
                self.assertFalse(list(env_file.parent.glob('.google-env-*')))
                with patch.object(getpass, 'getpass') as prompt:
                    with self.assertRaises(setup.SetupError):
                        setup.configure(env_file)
                    prompt.assert_not_called()

    def test_cancel_changed_file_and_existing_backup_preserve_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / 'code-lily.env'
            env_file.write_text(ORIGINAL)
            with patch.object(getpass, 'getpass', side_effect=[CLIENT_ID, KeyboardInterrupt]):
                with self.assertRaises(KeyboardInterrupt):
                    setup.configure(env_file)
            self.assertEqual(env_file.read_text(), ORIGINAL)
            def concurrent_edit(*args):
                env_file.write_text(ORIGINAL + '# changed\n')
                return SECRET
            with patch.object(getpass, 'getpass', side_effect=[CLIENT_ID, SECRET]):
                with patch.object(setup, 'validate_secret', side_effect=concurrent_edit):
                    with self.assertRaises(setup.SetupError):
                        setup.configure(env_file)
            self.assertEqual(env_file.read_text(), ORIGINAL + '# changed\n')
            env_file.with_name('code-lily.env.before-google').write_text('existing backup')
            with patch.object(getpass, 'getpass') as prompt:
                with self.assertRaises(setup.SetupError):
                    setup.configure(env_file)
                prompt.assert_not_called()

    @unittest.skipUnless(os.name == 'posix', 'Actual Linux terminal echo handling')
    def test_cli_uses_real_hidden_terminal_input_and_preserves_environment(self):
        import pty
        import select
        import shutil
        import subprocess
        import sys
        import time

        with tempfile.TemporaryDirectory(prefix='codelily-google-pty-') as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            (root / 'infra/env').mkdir(parents=True)
            script = root / 'scripts/configure-google.py'
            shutil.copyfile(module_path, script)
            env_file = root / 'infra/env/code-lily.env'
            env_file.write_text(ORIGINAL)
            master, slave = pty.openpty()
            process = subprocess.Popen([sys.executable, str(script)], stdin=slave,
                                       stdout=slave, stderr=slave, start_new_session=True)
            os.close(slave)
            output = bytearray()

            def wait_for(marker):
                deadline = time.monotonic() + 10
                while marker not in output:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        self.fail('CLI did not reach the expected hidden-input prompt.')
                    readable, _, _ = select.select([master], [], [], remaining)
                    if readable:
                        try:
                            chunk = os.read(master, 4096)
                        except OSError:
                            self.fail('CLI exited before the expected terminal output.')
                        if not chunk:
                            self.fail('CLI closed its terminal unexpectedly.')
                        output.extend(chunk)

            try:
                wait_for(b'GOOGLE_CLIENT_ID (hidden): ')
                os.write(master, CLIENT_ID.encode() + b'\n')
                wait_for(b'GOOGLE_CLIENT_SECRET (hidden): ')
                os.write(master, SECRET.encode() + b'\n')
                wait_for(b'Google settings saved; values omitted.')
                self.assertEqual(process.wait(timeout=10), 0)
                self.assertNotIn(CLIENT_ID.encode(), output)
                self.assertNotIn(SECRET.encode(), output)
                self.assertIn('GOOGLE_CLIENT_ID=' + CLIENT_ID, env_file.read_text())
                self.assertIn('GOOGLE_CLIENT_SECRET=' + SECRET, env_file.read_text())
                self.assertEqual(env_file.with_name('code-lily.env.before-google').read_text(), ORIGINAL)
                self.assertEqual(stat.S_IMODE(env_file.stat().st_mode), 0o600)
            finally:
                if process.poll() is None:
                    process.terminate()
                    process.wait(timeout=5)
                os.close(master)


if __name__ == '__main__':
    unittest.main()
