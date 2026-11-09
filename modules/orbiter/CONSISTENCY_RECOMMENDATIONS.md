# Orbiter Graphics Consistency Recommendations

## Overview
This document outlines recommendations to make the Orbiter module's graphics display more consistently across different frame rates and devices.

## Key Issues Identified

### 1. Frame-Rate Dependent Updates
**Problem**: Particle decay, camera rotation, and emitter movement are currently frame-dependent, causing different visual speeds on different displays (60fps vs 120fps vs 144fps).

**Current Code Issues**:
- Line 439: `t = now * 0.001` is good, but other calculations don't use delta time
- Line 252: `this.decay = params.decayRate` - applied per frame, not per second
- Line 310: `this.life -= this.decay` - frame dependent
- Line 443: `autoOrbitAngle += params.rotSpeed * 0.01` - frame dependent

### 2. Mixed Time Sources
**Problem**: `getAnimatedEmitterPos()` uses `Date.now()` while animation loop uses `now` parameter, causing timing inconsistencies.

**Location**: Line 190 vs Line 438

### 3. Frame-Based Particle Creation
**Problem**: Particles are created using `frameCount % params.particleRate`, making creation rate vary with framerate.

**Location**: Line 500

### 4. Mixed Time Calculations in Colors
**Problem**: Color theme calculations use both `t` (time) and `frameCount` (frame-based), causing inconsistencies.

**Location**: Line 530

## Recommended Solutions

### Solution 1: Implement Delta Time Tracking

Add delta time tracking to the animation loop:

```javascript
let lastFrameTime = 0;

function animate(now = 0) {
  animationId = requestAnimationFrame(animate);
  
  // Calculate delta time in seconds
  const deltaTime = lastFrameTime === 0 ? 0.016 : (now - lastFrameTime) * 0.001;
  lastFrameTime = now;
  
  // Clamp delta time to prevent large jumps (e.g., tab switching)
  const clampedDelta = Math.min(deltaTime, 0.1);
  
  t = now * 0.001;
  frameCount++;
  
  // ... rest of animation code using clampedDelta
}
```

### Solution 2: Make Particle Decay Frame-Independent

Update the Particle class:

```javascript
class Particle {
  update(currColor, deltaTime) {
    this.life -= this.decay * deltaTime; // Now frame-independent
    
    // ... rest of update code
  }
}
```

### Solution 3: Use Time-Based Particle Creation

Replace frame-based particle creation with time-based:

```javascript
let lastParticleCreationTime = 0;
const particleCreationInterval = 1.0 / params.particleRate; // Convert rate to interval

// In animate function:
if (audioData) {
  // ... audio processing code ...
  
  const timeSinceLastCreation = now * 0.001 - lastParticleCreationTime;
  if (timeSinceLastCreation >= particleCreationInterval) {
    lastParticleCreationTime = now * 0.001;
    
    for (let i = 0; i < numEmitters; i++) {
      // ... create particles based on amplitude ...
      if (amplitude > params.sensitivity) {
        // Create particle
      }
    }
  }
}
```

### Solution 4: Fix Time Source Consistency

Update `getAnimatedEmitterPos` to accept time parameter:

```javascript
function getAnimatedEmitterPos(emitter, index, currentTime) {
  const baseAngle = emitter.baseAngle || 0;
  const angle = baseAngle + currentTime * params.rotSpeed;
  // ... rest of function
}
```

Then call it from animate with consistent time:
```javascript
let {x, y, z} = getAnimatedEmitterPos(emitter, i, t);
```

### Solution 5: Make Camera Rotation Time-Based

Instead of accumulating angles, calculate from elapsed time:

```javascript
if (rotationMode === 'auto') {
  const angle = params.rotSpeed * t;
  camera.position.x = Math.cos(angle) * 29;
  camera.position.z = Math.sin(angle) * 29;
  camera.position.y = 7;
  camera.lookAt(0, 0, 0);
}
```

### Solution 6: Remove Frame Count from Color Calculations

Use only time-based calculations:

```javascript
// Instead of: t + frameCount * 0.012
const themeColor = themeFunctions[params.currentTheme](pIndex, t, numEmitters);
```

### Solution 7: Emitter Position Updates

Update emitters using consistent time source in the main loop, not separate Date.now() calls.

## Implementation Priority

1. **High Priority**: 
   - Delta time tracking (Solution 1)
   - Particle decay fix (Solution 2)
   - Time source consistency (Solution 4)

2. **Medium Priority**:
   - Time-based particle creation (Solution 3)
   - Camera rotation fix (Solution 5)

3. **Low Priority**:
   - Color calculation cleanup (Solution 6)

## Testing Considerations

After implementing these changes:
- Test on displays with different refresh rates (60Hz, 120Hz, 144Hz)
- Test when tab is inactive and returns (large delta time jumps)
- Verify particle density remains consistent regardless of framerate
- Ensure smooth camera rotation across different frame rates

## Additional Considerations

- Consider adding a maximum delta time clamp (e.g., 0.1s) to handle tab switching
- May want to add FPS counter for debugging
- Consider using `performance.now()` instead of `Date.now()` for better precision







