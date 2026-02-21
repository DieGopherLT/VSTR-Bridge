import { CommandValidator } from './command-validator';

describe('CommandValidator', () => {
  describe('validateCommand', () => {
    it('allows basic safe commands', () => {
      const validator = new CommandValidator();

      const result = validator.validateCommand('ls');

      expect(result.isValid).toBe(true);
    });

    it('allows cat command', () => {
      const validator = new CommandValidator();

      const result = validator.validateCommand('cat file.txt');

      expect(result.isValid).toBe(true);
    });

    it('allows echo command', () => {
      const validator = new CommandValidator();

      const result = validator.validateCommand('echo hello');

      expect(result.isValid).toBe(true);
    });

    it('allows git command', () => {
      const validator = new CommandValidator();

      const result = validator.validateCommand('git status');

      expect(result.isValid).toBe(true);
    });

    it('blocks rm command', () => {
      const validator = new CommandValidator();

      const result = validator.validateCommand('rm -rf /');

      expect(result.isValid).toBe(false);
    });

    it('blocks sudo command', () => {
      const validator = new CommandValidator();

      const result = validator.validateCommand('sudo apt install');

      expect(result.isValid).toBe(false);
    });

    it('blocks chmod 777 command', () => {
      const validator = new CommandValidator();

      const result = validator.validateCommand('chmod 777 file.txt');

      expect(result.isValid).toBe(false);
    });

    it('blocks path traversal attempts', () => {
      const validator = new CommandValidator();

      const result = validator.validateCommand('cat ../../etc/passwd');

      expect(result.isValid).toBe(false);
    });
  });

  describe('platform behavior', () => {
    it('blocks unix-only dangerous commands on linux', () => {
      const validator = new CommandValidator({}, 'linux');

      const result = validator.validateCommand('rmdir /tmp/test');

      expect(result.isValid).toBe(false);
    });

    it('blocks windows-only dangerous commands on win32', () => {
      const validator = new CommandValidator({}, 'win32');

      const result = validator.validateCommand('del file.txt');

      expect(result.isValid).toBe(false);
    });

    it('allows windows-only dangerous command on linux', () => {
      const validator = new CommandValidator({}, 'linux');

      const result = validator.validateCommand('del file.txt');

      expect(result.isValid).toBe(true);
    });

    it('allows unix-only dangerous command on win32', () => {
      const validator = new CommandValidator({}, 'win32');

      const result = validator.validateCommand('umount /dev/sda1');

      expect(result.isValid).toBe(true);
    });
  });

  describe('addSafeCommand', () => {
    it('allows a previously blocked command after adding it to safe commands', () => {
      const validator = new CommandValidator();
      validator.addSafeCommand('curl');

      const result = validator.validateCommand('curl https://example.com');

      expect(result.isValid).toBe(true);
    });

    it('does not duplicate a safe command when added twice', () => {
      const validator = new CommandValidator();
      validator.addSafeCommand('mycommand');
      validator.addSafeCommand('mycommand');

      expect(validator.getSafeCommands()).toHaveLength(1);
    });
  });

  describe('removeSafeCommand', () => {
    it('blocks a command after it is removed from safe commands', () => {
      const validator = new CommandValidator();
      validator.addSafeCommand('curl');
      validator.removeSafeCommand('curl');

      const result = validator.validateCommand('curl https://example.com');

      expect(result.isValid).toBe(false);
    });
  });
});
