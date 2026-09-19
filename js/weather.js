// Dynamic weather system: controls rain cycle (5-15 min intervals, 1-3 min duration),
// 2x catch luck multiplier, rain particles for canvas, and notifications.

export class WeatherSystem {
  constructor({ onWeatherChange }) {
    this.onWeatherChange = onWeatherChange ?? (() => {});
    this.currentWeather = "clear"; // "clear" | "rain"
    this.rainTimer = 0;
    this.rainDuration = 0;
    this.nextRainIn = this.randomBetween(300, 900); // 5-15 mins
    this.drops = [];
    this.splashes = [];
    this.maxDrops = 140;
    this.initParticles();
  }

  randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  initParticles() {
    this.drops = [];
    for (let i = 0; i < this.maxDrops; i += 1) {
      this.drops.push({
        x: Math.random(),
        y: Math.random(),
        speed: 1.2 + Math.random() * 0.9,
        length: 12 + Math.random() * 10,
        alpha: 0.35 + Math.random() * 0.45,
      });
    }
  }

  update(dt) {
    const safeDt = Math.min(dt, 0.1);

    if (this.currentWeather === "rain") {
      this.rainTimer += safeDt;
      if (this.rainTimer >= this.rainDuration) {
        this.setWeather("clear");
      }
    } else {
      this.nextRainIn -= safeDt;
      if (this.nextRainIn <= 0) {
        const duration = this.randomBetween(60, 180); // 1-3 mins
        this.setWeather("rain", duration);
      }
    }

    // Update splash particles
    this.splashes = this.splashes
      .map((s) => ({ ...s, age: s.age + safeDt }))
      .filter((s) => s.age < s.life);
  }

  setWeather(weather, duration = 120) {
    const prev = this.currentWeather;
    this.currentWeather = weather;

    if (weather === "rain") {
      this.rainDuration = duration;
      this.rainTimer = 0;
      this.onWeatherChange({
        weather: "rain",
        luckMultiplier: 2.0,
        message: "🌧️ Пішов теплий дощ! Клювання активізувалося, рідкісна риба ловиться вдвічі частіше (2x Luck)! 🍀",
      });
    } else {
      this.currentWeather = "clear";
      this.nextRainIn = this.randomBetween(300, 900); // 5-15 mins
      if (prev === "rain") {
        this.onWeatherChange({
          weather: "clear",
          luckMultiplier: 1.0,
          message: "☀️ Хмари розійшлися, над водою знову світить ясне сонце.",
        });
      }
    }
  }

  toggleRain() {
    if (this.currentWeather === "rain") {
      this.setWeather("clear");
    } else {
      this.setWeather("rain", 120);
    }
    return this.currentWeather;
  }

  isRaining() {
    return this.currentWeather === "rain";
  }

  getLuckMultiplier() {
    return this.currentWeather === "rain" ? 2.0 : 1.0;
  }

  getStatus() {
    if (this.currentWeather === "rain") {
      const remainingSec = Math.max(0, Math.ceil(this.rainDuration - this.rainTimer));
      const m = Math.floor(remainingSec / 60);
      const s = remainingSec % 60;
      return {
        weather: "rain",
        label: "🌧️ Дощ (2x Удача!)",
        timerText: `${m}:${s.toString().padStart(2, "0")}`,
        luckMultiplier: 2.0,
      };
    }

    const nextSec = Math.max(0, Math.ceil(this.nextRainIn));
    const m = Math.floor(nextSec / 60);
    const s = nextSec % 60;
    return {
      weather: "clear",
      label: "☀️ Сонячно",
      timerText: `Дощ через: ${m}:${s.toString().padStart(2, "0")}`,
      luckMultiplier: 1.0,
    };
  }
}

