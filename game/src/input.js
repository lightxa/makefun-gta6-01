// Keyboard and mouse input for Solmar Bay.
// WASD / arrows move and drive, E enters or leaves a car, Space punches,
// mouse aims and click shoots, Shift sprints, P or Esc pauses, M mutes,
// Enter confirms menus, 1/2 switch fists and pistol. Held keys are read
// every frame; one-shot presses are queued so none is ever lost.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // one-shot: consumed by takePressed
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
  }

  down(code) { return this.keys.has(code); }

  takePressed(code) {
    if (this.pressed.has(code)) { this.pressed.delete(code); return true; }
    return false;
  }

  takeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  // Movement vector from WASD / arrows, normalised.
  moveVector() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
    return { x, y };
  }

  get sprint() { return this.down('ShiftLeft') || this.down('ShiftRight'); }
}
