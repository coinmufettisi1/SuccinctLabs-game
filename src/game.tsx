"use client";

import { GAME_CONFIG, GAME_HEALTH } from "./config";
import gsap from "gsap";
import { sound } from "@pixi/sound";
import {
  BulgePinchFilter,
  GlowFilter,
  GrayscaleFilter,
  MotionBlurFilter,
  RGBSplitFilter,
} from "pixi-filters";
import {
  AnimatedSprite,
  Application,
  Assets,
  BlurFilter,
  Container,
  Graphics,
  Rectangle,
  Sprite,
  Text,
  Texture,
  UPDATE_PRIORITY,
} from "pixi.js";
import { useEffect } from "react";

const SPEED = GAME_CONFIG.SHIP_SPEED;
const ROTATION_SPEED = GAME_CONFIG.SHIP_ROTATION_SPEED;
const MAX_ROTATION = GAME_CONFIG.SHIP_MAX_ROTATION;

export class Controller {
  state: {
    isPressed: boolean;
    target_x_pos: number;
    target_y_pos: number;
    autoShoot: boolean;
  };

  constructor() {
    this.state = {
      isPressed: false,
      target_x_pos: 0,
      target_y_pos: 0,
      autoShoot: true,
    };

    window.addEventListener("pointermove", (event) =>
      this.handlePointer(event)
    );
    window.addEventListener("touchstart", (event) => this.handleTouch(event));
    window.addEventListener("touchmove", (event) => this.handleTouch(event));
  }

  handlePointer(event: any) {
    this.state.isPressed = true;
    this.state.target_x_pos = event.clientX;
    this.state.target_y_pos = event.clientY;
  }

  handleTouch(event: any) {
    const x_pos = event.touches[0].clientX;
    const y_pos = event.touches[0].clientY;

    if (!x_pos) return;

    this.state.isPressed = true;
    this.state.target_x_pos = x_pos;
    this.state.target_y_pos = y_pos;
  }
}

function constrainProportions(sprite: any, size: number) {
  const scale = size / Math.max(sprite.width, sprite.height);
  sprite.scale.set(scale);
}

export default function Game() {
  async function setup() {
    const app = new Application({
      antialias: false,
    });

    await app.init({
      background: "#000",
      resizeTo: window,
      antialias: false,
    });

    document.body.appendChild(app.canvas);

    sound.add("laser-1", "/sounds/laser-1.mp3");
    sound.add("laser-2", "/sounds/laser-2.mp3");
    sound.add("explosion", "/sounds/explosion.mp3");
    sound.add("coin", "/sounds/coin.mp3");
    sound.add("game-over", "/sounds/game-over.mp3");
    sound.add("game-music", "/sounds/game-music.mp3");

    Assets.addBundle("fonts", [
      {
        alias: "Joystix",
        src: "/fonts/joystix.otf",
      },
    ]);

    await Assets.loadBundle("fonts");

    const shipTexture: Texture = await Assets.load("/images/ship.png");
    const shipSprite = new Sprite(shipTexture);

    const heartTexture = await Assets.load("/images/heart.png");
    const coinTexture = await Assets.load("/images/coin.png");
    const enemyTexture = await Assets.load("/images/moon.png");

    const explosionTexture = await Assets.load(
      "https://pixijs.com/assets/spritesheet/mc.json"
    );

    const explosionTextures: any[] = [];
    let i;

    for (i = 0; i < 26; i++) {
      const texture = Texture.from(`Explosion_Sequence_A ${i + 1}.png`);

      explosionTextures.push(texture);
    }

    function createStar(container: Container) {
      const h = Math.floor(Math.random() * 10);
      const w = Math.floor(Math.random() * 2);

      const star = new Graphics().rect(0, 0, w, h).fill({
        r: 255,
        g: 255,
        b: 255,
      });

      star.x = Math.random() * app.screen.width;
      star.y = Math.random() * app.screen.height;

      container.addChild(star);
    }

    function createStarContainerWithStars() {
      const starContainer = new Container();

      for (let i = 0; i < 100; i++) {
        createStar(starContainer);
      }

      return starContainer;
    }

    const starContainer_1 = createStarContainerWithStars();
    const starContainer_2 = createStarContainerWithStars();
    const starContainer_3 = createStarContainerWithStars();

    starContainer_1.position.set(0, 0);
    starContainer_2.position.set(0, app.screen.height);
    starContainer_3.position.set(0, -app.screen.height * 2);

    app.stage.addChild(starContainer_1);
    app.stage.addChild(starContainer_2);
    app.stage.addChild(starContainer_3);

    const gameMusic = await sound.play("game-music", {
      loop: true,
      volume: 0.1,
    });

    let isGamePaused = false;
    let isGameStarted = false;
    let gameStartedTimestamp;

    const gameStartContainer: Container = new Container();
    const gameStartText = new Text("Tap to Start", {
      fill: "white",
      fontSize: 32,
      fontFamily: "Joystix",
    });

    gameStartText.anchor.set(0.5);

    gameStartText.x = app.screen.width / 2;
    gameStartText.y = app.screen.height / 2;

    gameStartText.interactive = true;

    gameStartText.on("pointerdown", () => {
      gameStartContainer.visible = false;
      startGame();
    });

    gameStartContainer.addChild(gameStartText);

    app.stage.addChild(gameStartContainer);

    let isGameOver = false;
    let gameOverContainer: Container;
    gameOverContainer = new Container();

    const gameOverText = new Text("Game Over", {
      fill: "white",
      fontSize: 48,
      fontFamily: "Joystix",
    });

    gameOverText.anchor.set(0.5);
    gameOverText.x = app.screen.width / 2;
    gameOverText.y = app.screen.height / 2;

    gameOverContainer.addChild(gameOverText);

    const backToMenuButton = new Graphics()
      .beginFill(0xea580c)
      .roundRect(0, 0, 200, 50, 10)
      .endFill();

    backToMenuButton.interactive = true;

    backToMenuButton.pivot.set(
      backToMenuButton.width / 2,
      backToMenuButton.height / 2
    );
    backToMenuButton.x = app.screen.width / 2;
    backToMenuButton.y = app.screen.height / 2 + 150;

    gameOverContainer.addChild(backToMenuButton);

    const backToMenuText = new Text("Restart", {
      fill: "black",
      fontSize: 16,
      fontFamily: "Joystix",
    });

    backToMenuText.anchor.set(0.5);
    backToMenuText.x = app.screen.width / 2;
    backToMenuText.y = app.screen.height / 2 + 150;

    backToMenuText.interactive = true;
    let score = 0;

    backToMenuText.on("pointerdown", async () => {
      gameMusic.destroy();
      app.destroy(
        {
          removeView: true,
        },
        {
          children: true,
          context: true,
          style: true,
          texture: true,
          textureSource: true,
        }
      );

      window.location.reload();
    });

    gameOverContainer.addChild(backToMenuText);

    gameOverContainer.visible = false;
    gameOverContainer.zIndex = 100;
    app.stage.addChild(gameOverContainer);

    const shipY = app.screen.height - shipSprite.height / 2;

    shipSprite.anchor.set(0.5);
    shipSprite.x = app.screen.width / 2;
    constrainProportions(shipSprite, 150);
    shipSprite.y = shipY;
    shipSprite.zIndex = 1;

    app.stage.addChild(shipSprite);

    const controller = new Controller();

    const shootObj = new Graphics().rect(0, 0, 3, 10).fill(0xfff000);
    const shootGlowFilter = new GlowFilter({
      color: 0xfff000,
      alpha: 1,
      distance: 20,
      quality: 1,
    });

    const scoreText = new Text(score, {
      fill: "white",
      fontSize: 44,
      fontFamily: "Joystix",
    });

    scoreText.anchor.set(0.5);
    scoreText.zIndex = 1000;

    scoreText.x = app.screen.width / 2;
    scoreText.y = 50;

    const heartContainer = new Container();

    const grayFilter = new GrayscaleFilter();

    let hearts: any[] = [];
    let currentHeart = GAME_HEALTH;

    for (let i = 0; i < currentHeart; i++) {
      const heart = new Sprite(heartTexture);
      heart.anchor.set(0.5);
      constrainProportions(heart, 50);
      heart.x = i * heart.width;
      heart.filters = [grayFilter];
      heartContainer.addChild(heart);
      hearts.push(heart);
    }

    heartContainer.x = app.screen.width / 2 - heartContainer.width / 3;
    heartContainer.y = 125;

    function startGame() {
      isGameStarted = true;
      gameStartedTimestamp = Date.now();
      app.stage.addChild(heartContainer);
      app.stage.addChild(scoreText);
      setupComboSystem();

      setTimeout(() => {
        if (!isGameOver) spawnBoss();
      }, 60000);

      setTimeout(() => {
        if (!isGameOver) spawnBoss();
      }, 180000);
    }

    let benefits: any[] = [];
    function generateSize(min: number, max: number) {
      return Math.floor(Math.random() * (max - min + 1) + min);
    }

    function generateValue(min: number, max: number) {
      return Math.floor(Math.random() * (max - min + 1) + min);
    }

    let gameSpeed = GAME_CONFIG.BASE_SPEED_MULTIPLIER;
    let shipSpeed = GAME_CONFIG.BASE_SPEED_MULTIPLIER;

    function getSpeed(targetSpeed: number) {
      return targetSpeed * gameSpeed;
    }

    function getShipSpeed(targetSpeed: number) {
      return targetSpeed * shipSpeed;
    }

    function spawnBenefit() {
      const benefit: any = new Sprite(coinTexture);
      const xPos = Math.random() * app.screen.width;

      benefit.anchor.set(0.5);
      const size = generateSize(
        GAME_CONFIG.BENEFIT.MIN_SIZE,
        GAME_CONFIG.BENEFIT.MAX_SIZE
      );
      constrainProportions(benefit, size);
      benefit.direction = Math.random() > 0.5 ? "right" : "left";
      benefit.x = xPos;
      benefit.y = 0;
      benefit.speed = generateValue(
        GAME_CONFIG.BENEFIT.MIN_SPEED,
        GAME_CONFIG.BENEFIT.MAX_SPEED
      );
      benefit.xSpeed = generateValue(
        GAME_CONFIG.BENEFIT.MIN_X_SPEED,
        GAME_CONFIG.BENEFIT.MAX_X_SPEED
      );
      benefit.type = "coin";

      if (Math.random() < 0.2) {
        const powerUpTypes = ["shield", "rapidFire", "bomb", "extraLife"];
        benefit.type =
          powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

        switch (benefit.type) {
          case "shield":
            benefit.filters = [
              new GlowFilter({ color: 0x00ffff, distance: 15, quality: 0.5 }),
            ];
            benefit.tint = 0x00ffff;
            break;
          case "rapidFire":
            benefit.filters = [
              new GlowFilter({ color: 0xff0000, distance: 15, quality: 0.5 }),
            ];
            benefit.tint = 0xff0000;
            break;
          case "bomb":
            benefit.filters = [
              new GlowFilter({ color: 0xff00ff, distance: 15, quality: 0.5 }),
            ];
            benefit.tint = 0xff00ff;
            break;
          case "extraLife":
            benefit.filters = [
              new GlowFilter({ color: 0x00ff00, distance: 15, quality: 0.5 }),
            ];
            benefit.tint = 0x00ff00;
            break;
        }
      }

      app.stage.addChild(benefit);
      benefits.push(benefit);
      return benefit;
    }

    let enemies: any[] = [];

    function spawnEnemy() {
      const enemy: any = new Sprite(enemyTexture);
      enemy.anchor.set(0.5);

      const size = generateSize(
        GAME_CONFIG.ENEMY.MIN_SIZE,
        GAME_CONFIG.ENEMY.MAX_SIZE
      );
      constrainProportions(enemy, size);
      const xPos = Math.random() * app.screen.width;

      enemy.speed = generateValue(
        GAME_CONFIG.ENEMY.MIN_SPEED,
        GAME_CONFIG.ENEMY.MAX_SPEED
      );
      enemy.xSpeed = generateValue(
        GAME_CONFIG.ENEMY.MIN_X_SPEED,
        GAME_CONFIG.ENEMY.MAX_X_SPEED
      );
      enemy.direction = Math.random() > 0.5 ? "right" : "left";
      enemy.x = xPos;
      enemy.y = 0;

      app.stage.addChild(enemy);

      enemies.push(enemy);

      return enemy;
    }

    function rotateShip(deltaTime: number, direction: string) {
      const rotationSpeed = ROTATION_SPEED * deltaTime;
      if (direction == "left") {
        if (shipSprite.rotation > -MAX_ROTATION)
          shipSprite.rotation -= rotationSpeed;
      }
      if (direction == "right") {
        if (shipSprite.rotation < MAX_ROTATION)
          shipSprite.rotation += rotationSpeed;
      }
    }

    function handleShipBounds() {
      if (shipSprite.x - shipSprite.width / 2 < 0)
        shipSprite.x = shipSprite.width / 2;
      if (shipSprite.x > app.screen.width - shipSprite.width / 2)
        shipSprite.x = app.screen.width - shipSprite.width / 2;
      if (shipSprite.y - shipSprite.height / 2 < 0)
        shipSprite.y = shipSprite.height / 2;
      if (shipSprite.y > app.screen.height - shipSprite.height / 2)
        shipSprite.y = app.screen.height - shipSprite.height / 2;
    }

    function moveShip(deltaTime: number) {
      const speed = getShipSpeed(SPEED * deltaTime);

      if (controller.state.isPressed && controller.state.target_x_pos) {
        if (shipSprite.x > controller.state.target_x_pos) {
          shipSprite.x -= speed;
          rotateShip(deltaTime, "left");
        }

        if (shipSprite.x < controller.state.target_x_pos) {
          shipSprite.x += speed;
          rotateShip(deltaTime, "right");
        }

        if (shipSprite.y > controller.state.target_y_pos) {
          shipSprite.y -= speed;
        }

        if (shipSprite.y < controller.state.target_y_pos) {
          shipSprite.y += speed;
        }

        handleShipBounds();
        return;
      }
    }

    let bullets: any[] = [];

    function shoot() {
      sound.play(Math.random() > 0.5 ? "laser-1" : "laser-2", {
        volume: 0.1,
      });

      const bullet = shootObj.clone();
      bullet.x = shipSprite.x;
      bullet.y = shipSprite.y;
      bullet.filters = [shootGlowFilter];
      bullet.filterArea = new Rectangle(
        -bullet.width / 2,
        -bullet.height / 2,
        bullet.width,
        bullet.height
      );
      app.stage.addChild(bullet);

      bullets.push(bullet);
    }

    function createExplosion(x: any, y: any) {
      const explosion = new AnimatedSprite(explosionTextures);

      explosion.x = x;
      explosion.y = y;
      explosion.loop = false;
      explosion.anchor.set(0.5);
      explosion.rotation = Math.random() * Math.PI;
      explosion.scale.set(0.75 + Math.random() * 0.5);
      explosion.play();

      explosion.once("added", () => {
        sound.play("explosion", {
          volume: 0.1,
        });
      });

      app.stage.addChild(explosion);

      explosion.onComplete = () => {
        app.stage.removeChild(explosion);
      };
    }

    function checkCollision() {
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];

        if (
          !enemy.isBossProjectile &&
          !isGodmode &&
          !activeShield &&
          shipSprite.x >= enemy.x - enemy.width / 2 &&
          shipSprite.x <= enemy.x + enemy.width / 2 &&
          shipSprite.y >= enemy.y - enemy.height / 2 &&
          shipSprite.y <= enemy.y + enemy.height / 2
        ) {
          createExplosion(enemy.x, enemy.y);
          app.stage.removeChild(enemy);
          enemies.splice(i, 1);

          decreaseHealth(1);
          screenShakeIntensity = 15;
          screenShakeDecay = 0.9;
          screenShakeActive = true;

          continue;
        }

        for (let j = 0; j < bullets.length; j++) {
          const bullet = bullets[j];

          if (
            bullet.x >= enemy.x - enemy.width / 2 &&
            bullet.x <= enemy.x + enemy.width / 2 &&
            bullet.y >= enemy.y - enemy.height / 2 &&
            bullet.y <= enemy.y + enemy.height / 2
          ) {
            createExplosion(enemy.x, enemy.y);
            app.stage.removeChild(bullet);

            if (enemy === bossSprite) {
              damageBoss(1);
              bullets.splice(bullets.indexOf(bullet), 1);
              continue;
            }

            app.stage.removeChild(enemy);

            const comboBonus = incrementCombo();
            addScore(GAME_CONFIG.ENEMY.POINT * comboBonus, comboBonus > 1);

            createParticles(enemy.x, enemy.y, 0xffff00, 15);

            bullets.splice(bullets.indexOf(bullet), 1);
            enemies.splice(enemies.indexOf(enemy), 1);

            screenShakeIntensity = 3;
            screenShakeDecay = 0.8;
            screenShakeActive = true;
          }
        }
      }
    }

    const yellowGlowFilter = new GlowFilter({
      color: 0xfff000,
      alpha: 0.5,
      distance: 20,
      quality: 1,
    });

    function addScore(point: number, big = false) {
      score += point;
      scoreText.text = score;

      const scaleRatio = Math.min(1.5, 1 + point / 1000) * (big ? 2 : 1);

      if (big) {
        scoreText.filters = [yellowGlowFilter];
        setTimeout(() => {
          scoreText.filters = [];
        }, 150);
      }

      gsap.from(scoreText.scale, {
        x: scaleRatio,
        y: scaleRatio,
        duration: 0.5,
        ease: "elastic",
        onComplete: () => {
          gsap.to(scoreText.scale, {
            x: 1,
            y: 1,
            duration: 0.5,
          });
        },
      });
    }

    function animateDestroyHeart(index: number) {
      const heart = hearts[index];

      gsap.to(heart.scale, {
        x: 0,
        y: 0,
        duration: 0.5,
        onComplete: () => {
          heart.visible = false;
        },
      });
    }

    function gigaExplosionAnimate(fn: any, cb: any) {
      isGamePaused = true;

      const filter = new BulgePinchFilter({
        radius: 0,
        strength: 0,
      });
      const blurFilter = new BlurFilter(0, 8);

      app.stage.filters = [
        filter,
        new MotionBlurFilter(),
        new RGBSplitFilter(),
        blurFilter,
      ];

      gsap
        .timeline()
        .add("start")
        .to(
          blurFilter,
          {
            blur: 8,
            duration: 0.1,
            ease: "bounce",
          },
          "start"
        )
        .to(
          filter,
          {
            radius: 1000,
            strength: -0.75,
            duration: 0.1,
            ease: "bounce.in",
          },
          "start"
        )
        .to(filter, {
          radius: 1000,
          strength: 0.75,
          duration: 0.1,
          ease: "bounce.out",
        })
        .to(filter, {
          radius: 0,
          strength: 0,
          duration: 0.25,
          ease: "bounce",
          onComplete: () => {
            app.stage.filters = [];
            fn();
            cb();
            isGamePaused = false;
          },
        });
    }

    function explodeAll(fn: any) {
      gigaExplosionAnimate(
        () => {
          for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            setTimeout(() => {
              createExplosion(enemy.x, enemy.y);
              app.stage.removeChild(enemy);
            }, 25 * i);
          }

          for (let i = 0; i < bullets.length; i++) {
            const bullet = bullets[i];
            app.stage.removeChild(bullet);
          }

          for (let i = 0; i < benefits.length; i++) {
            const benefit = benefits[i];
            setTimeout(() => {
              createExplosion(benefit.x, benefit.y);
              app.stage.removeChild(benefit);
            }, 25 * i);
          }
        },
        () => {
          enemies = [];
          bullets = [];
          benefits = [];

          fn();
        }
      );
    }

    const godmodeText = new Text("Godmode", {
      fill: "yellow",
      fontSize: 24,
      fontFamily: "Joystix",
    });

    godmodeText.anchor.set(0.5);
    godmodeText.x = app.screen.width / 2;
    godmodeText.y = app.screen.height / 2;
    godmodeText.scale.set(0);

    godmodeText.visible = false;

    const godmodeCooldownText = new Text("Godmode cooldown", {
      fill: "yellow",
      fontSize: 24,
      fontFamily: "Joystix",
    });

    godmodeCooldownText.anchor.set(0.5);

    godmodeCooldownText.x = app.screen.width / 2;
    godmodeCooldownText.y = app.screen.height / 2 + 50;
    godmodeCooldownText.scale.set(0);

    godmodeCooldownText.visible = false;

    app.stage.addChild(godmodeText);
    app.stage.addChild(godmodeCooldownText);

    let isGodmode = false;
    let godmodeStartTimestamp;

    function startGodmode() {
      isGodmode = true;
      godmodeStartTimestamp = Date.now();

      godmodeText.visible = true;
      godmodeCooldownText.visible = true;

      gsap
        .timeline()
        .add("start")
        .to(
          godmodeText.scale,
          {
            x: 1,
            y: 1,
            duration: 0.5,
            ease: "bounce",
          },
          "start"
        )
        .to(
          godmodeCooldownText.scale,
          {
            x: 1,
            y: 1,
            duration: 0.5,
            delay: 0.25,
            ease: "bounce",
          },
          "start"
        );

      godmodeCooldownText.text = GAME_CONFIG.GODMODE_COOLDOWN.toString();

      const interval = setInterval(() => {
        godmodeCooldownText.text = (
          GAME_CONFIG.GODMODE_COOLDOWN -
          Math.floor((Date.now() - godmodeStartTimestamp) / 1000)
        ).toString();

        if (
          Date.now() - godmodeStartTimestamp >
          GAME_CONFIG.GODMODE_COOLDOWN * 1000
        ) {
          clearInterval(interval);

          gsap
            .timeline({
              onComplete: () => {
                godmodeCooldownText.visible = false;
                godmodeText.visible = false;
                isGodmode = false;
              },
            })
            .add("start")
            .to(
              godmodeText.scale,
              {
                x: 0,
                y: 0,
                duration: 0.5,
                ease: "bounce",
              },
              "start"
            )
            .to(
              godmodeCooldownText.scale,
              {
                x: 0,
                y: 0,
                duration: 0.5,
                ease: "bounce",
              },
              "start"
            );
        }
      }, 1000);
    }

    function decreaseHealth(point: number) {
      if (isGodmode) return;
      currentHeart -= point;

      if (currentHeart < 0) {
        currentHeart = 0;
      }

      animateDestroyHeart(currentHeart);
      explodeAll(() => {
        if (currentHeart > 0) {
          startGodmode();
        }
      });
    }

    function simulateBullets(deltaTime: number) {
      const speed = getSpeed(GAME_CONFIG.BULLET_SPEED * deltaTime);

      for (let i = 0; i < bullets.length; i++) {
        const bullet = bullets[i];
        bullet.y -= speed;

        if (bullet.y < 0) {
          app.stage.removeChild(bullet);
          bullets.splice(i, 1);
        }
      }
    }

    let lastShoot = Date.now();

    function simulateBenefits(deltaTime: number) {
      for (let i = 0; i < benefits.length; i++) {
        const benefit = benefits[i];
        const speed = getSpeed(benefit.speed * deltaTime);
        const xSpeed = getSpeed(benefit.xSpeed * deltaTime);

        benefit.y += speed;

        if (benefit.x > app.screen.width - benefit.width / 2) {
          benefit.direction = "left";
        } else if (benefit.x < benefit.width / 2) {
          benefit.direction = "right";
        }

        if (benefit.direction == "right") {
          benefit.x += xSpeed;
        } else if (benefit.direction == "left") {
          benefit.x -= xSpeed;
        } else {
          benefit.x += xSpeed;
        }

        if (benefit.y > app.screen.height) {
          app.stage.removeChild(benefit);
          benefits.splice(i, 1);
        }
      }
    }

    function checkBenefitCollision() {
      for (let i = 0; i < benefits.length; i++) {
        const benefit = benefits[i];

        if (
          shipSprite.x >= benefit.x - shipSprite.width / 2 &&
          shipSprite.x <= benefit.x + shipSprite.width / 2 &&
          shipSprite.y >= benefit.y - shipSprite.height / 2 &&
          shipSprite.y <= benefit.y + shipSprite.height / 2
        ) {
          sound.play("coin", {
            volume: 0.1,
          });
          app.stage.removeChild(benefit);

          switch (benefit.type) {
            case "shield":
              createShield();
              break;
            case "rapidFire":
              activateRapidFire();
              break;
            case "bomb":
              activateBomb();
              break;
            case "extraLife":
              addExtraLife();
              break;
            default:
              addScore(GAME_CONFIG.BENEFIT.POINT);
              break;
          }

          benefits.splice(i, 1);
        }
      }
    }

    function simulateEnemies(deltaTime: number) {
      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        const speed = getSpeed(enemy.speed * deltaTime);
        const xSpeed = getSpeed(enemy.xSpeed * deltaTime);

        enemy.y += speed;

        if (enemy.x > app.screen.width - enemy.width / 2) {
          enemy.direction = "left";
        } else if (enemy.x < enemy.width / 2) {
          enemy.direction = "right";
        }

        if (enemy.direction == "right") {
          enemy.x += xSpeed;
        } else if (enemy.direction == "left") {
          enemy.x -= xSpeed;
        } else {
          enemy.x += xSpeed;
        }

        if (enemy.y > app.screen.height) {
          decreaseHealth(1);
          app.stage.removeChild(enemy);
          enemies.splice(i, 1);
        }
      }
    }

    let shipDirectionFactor = "up";

    function simulateShipShake(deltaTime: number) {
      const speed = GAME_CONFIG.SHIP_SHAKE_SPEED * deltaTime;

      if (shipSprite.y > shipY + 5) {
        shipDirectionFactor = "down";
      }

      if (shipSprite.y <= shipY) {
        shipDirectionFactor = "up";
      }

      if (shipDirectionFactor == "up") {
        shipSprite.y += speed;
      } else {
        shipSprite.y -= speed;
      }
    }

    function simulateStarContainers(deltaTime: number) {
      const speed = getSpeed(GAME_CONFIG.STAR_SPEED * deltaTime);

      starContainer_1.y += speed;
      starContainer_2.y += speed;
      starContainer_3.y += speed;

      if (starContainer_1.y > app.screen.height) {
        starContainer_1.y = -app.screen.height;
      }

      if (starContainer_2.y > app.screen.height) {
        starContainer_2.y = -app.screen.height;
      }

      if (starContainer_3.y > app.screen.height) {
        starContainer_3.y = -app.screen.height;
      }
    }

    let lastBenefitSpawn = Date.now();
    let lastEnemySpawn = Date.now();

    function handleSpawnEvents() {
      if (Date.now() - lastBenefitSpawn > GAME_CONFIG.BENEFIT_SPAWN_DELAY) {
        spawnBenefit();
        lastBenefitSpawn = Date.now();
      }

      if (Date.now() - lastEnemySpawn > GAME_CONFIG.ENEMY_SPAWN_DELAY) {
        spawnEnemy();
        lastEnemySpawn = Date.now();
      }
    }

    function handleShoot() {
      const shootDelay = rapidFireActive
        ? GAME_CONFIG.SHOOT_DELAY / 3
        : GAME_CONFIG.SHOOT_DELAY;

      if (rapidFireActive && Date.now() > rapidFireEndTime) {
        rapidFireActive = false;
      }

      if (controller.state.autoShoot && Date.now() - lastShoot > shootDelay) {
        shoot();

        if (rapidFireActive) {
          createParticles(shipSprite.x, shipSprite.y - 20, 0xff0000, 5);
        }

        lastShoot = Date.now();
      }
    }

    function handleSpeed() {
      const currentTime = Date.now();
      if (currentTime - gameStartedTimestamp > GAME_CONFIG.SPEED_UP_INTERVAL) {
        console.log("speed up");
        gameSpeed += GAME_CONFIG.SPEED_UP_MULTIPLIER;
        shipSpeed += GAME_CONFIG.SHIP_SPEED_UP_MULTIPLIER;

        gameStartedTimestamp = currentTime;
      }
    }

    async function gameOver() {}

    let activeShield = false;
    let shieldSprite: Sprite | null = null;
    let rapidFireActive = false;
    let rapidFireEndTime = 0;
    let comboCount = 0;
    let comboTimer = 0;
    let comboText: Text;
    let screenShakeActive = false;
    let screenShakeIntensity = 0;
    let screenShakeDecay = 0;
    let bossActive = false;
    let bossSprite: Sprite | null = null;
    let bossHealth = 0;
    let bossHealthBar: Graphics | null = null;
    let particleContainer = new Container();

    function setupComboSystem() {
      comboText = new Text("", {
        fill: "yellow",
        fontSize: 32,
        fontFamily: "Joystix",
        stroke: 0x000000,
      });
      comboText.anchor.set(0.5);
      comboText.x = app.screen.width - 100;
      comboText.y = 50;
      comboText.visible = false;
      app.stage.addChild(comboText);
      app.stage.addChild(particleContainer);
    }

    function createShield() {
      if (shieldSprite) {
        app.stage.removeChild(shieldSprite);
      }

      shieldSprite = new Sprite(Texture.WHITE);
      shieldSprite.width = shipSprite.width * 1.5;
      shieldSprite.height = shipSprite.height * 1.5;
      shieldSprite.anchor.set(0.5);
      shieldSprite.tint = 0x00ffff;
      shieldSprite.alpha = 0.5;
      shieldSprite.filters = [
        new GlowFilter({ color: 0x00ffff, distance: 15, quality: 0.5 }),
      ];
      app.stage.addChild(shieldSprite);

      activeShield = true;

      setTimeout(() => {
        if (shieldSprite) {
          gsap.to(shieldSprite, {
            alpha: 0,
            duration: 1,
            onComplete: () => {
              if (shieldSprite) {
                app.stage.removeChild(shieldSprite);
                shieldSprite = null;
              }
              activeShield = false;
            },
          });
        }
      }, 10000);
    }

    function activateBomb() {
      screenShakeIntensity = 20;
      screenShakeDecay = 0.9;
      screenShakeActive = true;

      const ring = new Graphics()
        .circle(0, 0, 10)
        .fill({ color: 0xff00ff, alpha: 0.7 });
      ring.x = shipSprite.x;
      ring.y = shipSprite.y;
      ring.filters = [
        new GlowFilter({ color: 0xff00ff, distance: 30, quality: 0.5 }),
      ];
      app.stage.addChild(ring);

      gsap.to(ring.scale, {
        x: 50,
        y: 50,
        duration: 1.5,
        ease: "power2.out",
        onComplete: () => {
          app.stage.removeChild(ring);
        },
      });

      gsap.to(ring, {
        alpha: 0,
        duration: 1.5,
        ease: "power2.out",
      });

      for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i];
        createExplosion(enemy.x, enemy.y);
        app.stage.removeChild(enemy);
        addScore(GAME_CONFIG.ENEMY.POINT, true);
      }
      enemies = [];

      sound.play("explosion", {
        volume: 0.3,
      });
    }

    function activateRapidFire() {
      rapidFireActive = true;
      rapidFireEndTime = Date.now() + 5000;

      const rapidFireText = new Text("RAPID FIRE!", {
        fill: "red",
        fontSize: 32,
        fontFamily: "Joystix",
        stroke: 0x000000,
      });

      rapidFireText.anchor.set(0.5);
      rapidFireText.x = app.screen.width / 2;
      rapidFireText.y = app.screen.height / 2 - 100;
      app.stage.addChild(rapidFireText);

      gsap.to(rapidFireText, {
        alpha: 0,
        y: rapidFireText.y - 50,
        duration: 1,
        onComplete: () => {
          app.stage.removeChild(rapidFireText);
        },
      });
    }

    function addExtraLife() {
      if (currentHeart < GAME_HEALTH) {
        currentHeart++;
        const heart = hearts[currentHeart - 1];
        heart.visible = true;
        heart.filters = [];

        gsap.from(heart.scale, {
          x: 2,
          y: 2,
          duration: 0.5,
          ease: "elastic",
        });

        const lifeText = new Text("+1 LIFE!", {
          fill: "green",
          fontSize: 32,
          fontFamily: "Joystix",
          stroke: 0x000000,
        });

        lifeText.anchor.set(0.5);
        lifeText.x = app.screen.width / 2;
        lifeText.y = app.screen.height / 2 - 100;
        app.stage.addChild(lifeText);

        gsap.to(lifeText, {
          alpha: 0,
          y: lifeText.y - 50,
          duration: 1,
          onComplete: () => {
            app.stage.removeChild(lifeText);
          },
        });
      }
    }

    function createParticles(
      x: number,
      y: number,
      color: number,
      count: number
    ) {
      for (let i = 0; i < count; i++) {
        const particle: any = new Graphics()
          .circle(0, 0, 2 + Math.random() * 3)
          .fill({ color });

        particle.x = x;
        particle.y = y;
        particle.vx = (Math.random() - 0.5) * 5;
        particle.vy = (Math.random() - 0.5) * 5;
        particle.alpha = 0.7 + Math.random() * 0.3;
        particle.life = 30 + Math.random() * 30;

        particleContainer.addChild(particle);
      }
    }

    function updateParticles(deltaTime: number) {
      for (let i = particleContainer.children.length - 1; i >= 0; i--) {
        const particle: any = particleContainer.children[i];

        particle.x += particle.vx * deltaTime;
        particle.y += particle.vy * deltaTime;
        particle.life -= deltaTime;
        particle.alpha = Math.max(0, particle.life / 60);

        if (particle.life <= 0) {
          particleContainer.removeChildAt(i);
        }
      }
    }

    function spawnBoss() {
      if (bossActive) return;

      bossActive = true;

      const bossText = new Text("BOSS INCOMING!", {
        fill: "red",
        fontSize: 48,
        fontFamily: "Joystix",
        stroke: 0x000000,
      });

      bossText.anchor.set(0.5);
      bossText.x = app.screen.width / 2;
      bossText.y = app.screen.height / 2;
      app.stage.addChild(bossText);

      gsap.to(bossText.scale, {
        x: 1.5,
        y: 1.5,
        duration: 1,
        repeat: 1,
        yoyo: true,
        onComplete: () => {
          app.stage.removeChild(bossText);
          createBoss();
        },
      });
    }

    function createBoss() {
      bossSprite = new Sprite(enemyTexture);
      bossSprite.anchor.set(0.5);
      constrainProportions(bossSprite, 300);
      bossSprite.x = app.screen.width / 2;
      bossSprite.y = -bossSprite.height;
      bossSprite.tint = 0xff0000;

      bossSprite.filters = [
        new GlowFilter({ color: 0xff0000, distance: 20, quality: 0.5 }),
        new RGBSplitFilter([5, 0], [0, 0], [-5, 0]),
      ];

      app.stage.addChild(bossSprite);

      bossHealth = 100;
      bossHealthBar = new Graphics();
      updateBossHealthBar();
      app.stage.addChild(bossHealthBar);

      gsap.to(bossSprite, {
        y: 150,
        duration: 2,
        ease: "bounce",
      });
    }

    function updateBossHealthBar() {
      if (!bossHealthBar || !bossSprite) return;

      bossHealthBar.clear();

      bossHealthBar.beginFill(0x333333);
      bossHealthBar.drawRect(app.screen.width / 2 - 150, 50, 300, 20);
      bossHealthBar.endFill();

      bossHealthBar.beginFill(0xff0000);
      bossHealthBar.drawRect(
        app.screen.width / 2 - 150,
        50,
        300 * (bossHealth / 100),
        20
      );
      bossHealthBar.endFill();
    }

    function updateBoss(deltaTime: number) {
      if (!bossActive || !bossSprite) return;

      const time = Date.now() / 1000;
      const amplitude = 100;
      const frequency = 0.5;

      bossSprite.x =
        app.screen.width / 2 + Math.sin(time * frequency) * amplitude;
      bossSprite.y = 150 + (Math.sin(time * frequency * 2) * amplitude) / 2;

      if (Math.random() < 0.05) {
        shootBossProjectile();
      }

      if (Math.random() < 0.01) {
        for (let i = 0; i < 3; i++) {
          const enemy = spawnEnemy();
          enemy.x = bossSprite.x;
          enemy.y = bossSprite.y;
          enemy.tint = 0xff0000;
        }
      }
    }

    function shootBossProjectile() {
      if (!bossSprite) return;

      const projectile: any = new Graphics().circle(0, 0, 10).fill(0xff0000);

      projectile.x = bossSprite.x;
      projectile.y = bossSprite.y;
      projectile.filters = [
        new GlowFilter({ color: 0xff0000, distance: 10, quality: 0.5 }),
      ];

      const dx = shipSprite.x - bossSprite.x;
      const dy = shipSprite.y - bossSprite.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      projectile.vx = (dx / length) * 5;
      projectile.vy = (dy / length) * 5;
      projectile.isBossProjectile = true;

      app.stage.addChild(projectile);
      enemies.push(projectile);
    }

    function damageBoss(damage: number) {
      if (!bossActive || !bossSprite) return;

      bossHealth -= damage;
      updateBossHealthBar();

      bossSprite.alpha = 0.5;
      setTimeout(() => {
        if (bossSprite) bossSprite.alpha = 1;
      }, 100);

      createParticles(bossSprite.x, bossSprite.y, 0xff0000, 10);

      if (bossHealth <= 0) {
        defeatBoss();
      }
    }

    function defeatBoss() {
      if (!bossSprite || !bossHealthBar) return;

      for (let i = 0; i < 10; i++) {
        setTimeout(() => {
          if (bossSprite) {
            const offsetX = (Math.random() - 0.5) * bossSprite.width;
            const offsetY = (Math.random() - 0.5) * bossSprite.height;
            createExplosion(bossSprite.x + offsetX, bossSprite.y + offsetY);
          }
        }, i * 200);
      }

      screenShakeIntensity = 30;
      screenShakeDecay = 0.9;
      screenShakeActive = true;

      addScore(5000, true);

      app.stage.removeChild(bossSprite);
      app.stage.removeChild(bossHealthBar);
      bossSprite = null;
      bossHealthBar = null;
      bossActive = false;

      const victoryText = new Text("BOSS DEFEATED!", {
        fill: "gold",
        fontSize: 48,
        fontFamily: "Joystix",
        stroke: 0x000000,
      });

      victoryText.anchor.set(0.5);
      victoryText.x = app.screen.width / 2;
      victoryText.y = app.screen.height / 2;
      app.stage.addChild(victoryText);

      gsap.to(victoryText.scale, {
        x: 1.5,
        y: 1.5,
        duration: 1,
        repeat: 1,
        yoyo: true,
        onComplete: () => {
          gsap.to(victoryText, {
            alpha: 0,
            duration: 1,
            onComplete: () => {
              app.stage.removeChild(victoryText);
            },
          });
        },
      });
    }

    function applyScreenShake() {
      if (!screenShakeActive) return;

      const shakeX = (Math.random() - 0.5) * screenShakeIntensity;
      const shakeY = (Math.random() - 0.5) * screenShakeIntensity;

      app.stage.x = shakeX;
      app.stage.y = shakeY;

      screenShakeIntensity *= screenShakeDecay;

      if (screenShakeIntensity < 0.5) {
        screenShakeActive = false;
        app.stage.x = 0;
        app.stage.y = 0;
      }
    }

    function updateCombo(deltaTime: number) {
      if (comboCount > 0) {
        comboTimer -= deltaTime;

        if (comboTimer <= 0) {
          comboCount = 0;
          comboText.visible = false;
        }
      }
    }

    function incrementCombo() {
      if (!comboText) {
        setupComboSystem();
      }

      comboCount++;
      comboTimer = 120;

      comboText.text = `${comboCount}x COMBO!`;
      comboText.visible = true;

      gsap.from(comboText.scale, {
        x: 1.5,
        y: 1.5,
        duration: 0.3,
        ease: "elastic",
      });

      if (comboCount >= 10) {
        comboText.style.fill = "gold";
      } else if (comboCount >= 5) {
        comboText.style.fill = "orange";
      } else {
        comboText.style.fill = "yellow";
      }

      return Math.min(comboCount, 10);
    }

    app.ticker.add((time) => {
      if (isGamePaused) return;
      if (!isGameStarted) return;
      if (isGameOver) return;

      if (currentHeart <= 0) {
        gameMusic.destroy();
        sound.play("game-over", {
          volume: 0.1,
        });

        createExplosion(shipSprite.x, shipSprite.y);
        app.stage.removeChild(shipSprite);
        gsap.to(scoreText.style, {
          fontSize: 100,
          duration: 2,
        });
        gsap.to(scoreText, {
          y: app.screen.height / 2 - 100,
          duration: 2,
        });
        isGameOver = true;
        gameOverContainer.visible = true;

        gameOver();
        return;
      }

      moveShip(time.deltaTime);
      simulateBullets(time.deltaTime);
      simulateBenefits(time.deltaTime);
      simulateEnemies(time.deltaTime);
      simulateShipShake(time.deltaTime);
      simulateStarContainers(time.deltaTime);
      handleSpawnEvents();
      handleShoot();
      handleSpeed();
      updateParticles(time.deltaTime);
      updateCombo(time.deltaTime);
      updateBoss(time.deltaTime);
      applyScreenShake();

      if (activeShield && shieldSprite) {
        shieldSprite.x = shipSprite.x;
        shieldSprite.y = shipSprite.y;
      }
    });

    app.ticker.add(
      () => {
        checkBenefitCollision();
        checkCollision();
      },
      undefined,
      UPDATE_PRIORITY.INTERACTION
    );
  }

  useEffect(() => {
    setup();
  }, []);

  return <></>;
}
