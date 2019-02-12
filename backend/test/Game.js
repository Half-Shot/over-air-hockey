const expect = require('chai').expect;
const Game = require("../lib/Game");
const log = require("npmlog");
function mockWs() {
    return {
        msgs: [],
        on: () => {},
        sendJson: function (msg) {
            this.msgs = (this.msgs || []).concat([msg]);
        },
    }
}

function startGame() {
    const game = new Game();
    const conn1 = mockWs();
    const conn2 = mockWs();
    game.addConnection(conn1, "controller", "alice");
    game.addConnection(conn2, "controller", "bob");
    game.setPlayerReady(conn1);
    game.setPlayerReady(conn2);
    game.start(0);
    return {game, conn1, conn2}
}

describe('Game', function() {
  describe('paddleMoved()', function() {
      it("should hit puck when hitting forwards", () => {
          const {game, conn1, conn2} = startGame();
          game.puck.x = 40;
          game.puck.y = game.table.height / 2;
          const didHit = game.paddleMoved(conn1, {
              left: 0,
              right: 0,
              forward: 25,
          });
          expect(didHit).to.be.true;
          const hitMsg = conn1.msgs.find((msg) => msg.type === "puckUpdate");
          expect(hitMsg).to.exist;
          expect(hitMsg.puck.velocityX).to.equal(25);
          expect(hitMsg.puck.velocityY).to.equal(0);
      });
      it("should hit puck when hitting from the right side", () => {
          const {game, conn1, conn2} = startGame();
          game.puck.x = 40;
          game.puck.y = game.table.height / 2;
          const didHit = game.paddleMoved(conn1, {
              left: 0,
              right: 25,
              forward: 25,
          });
          expect(didHit).to.be.true;
          const hitMsg = conn1.msgs.find((msg) => msg.type === "puckUpdate");
          expect(hitMsg).to.exist;
          expect(hitMsg.puck.velocityX).to.equal(25);
          expect(hitMsg.puck.velocityY).to.equal(-25);
      });
      it("should hit puck when hitting from the left side", () => {
          const {game, conn1, conn2} = startGame();
          game.puck.x = 40;
          game.puck.y = game.table.height / 2;
          const didHit = game.paddleMoved(conn1, {
              left: 25,
              right: 0,
              forward: 25,
          });
          expect(didHit).to.be.true;
          const hitMsg = conn1.msgs.find((msg) => msg.type === "puckUpdate");
          expect(hitMsg).to.exist;
          expect(hitMsg.puck.velocityX).to.equal(25);
          expect(hitMsg.puck.velocityY).to.equal(25);
      });
      // it("should hit puck when hitting forwards from the opposite side", () => {
      //     const {game, conn1, conn2} = startGame();
      //     game.puck.x = game.table.width - 60;
      //     game.puck.y = game.table.height / 2;
      //     const didHit = game.paddleMoved(conn2, {
      //         left: 0,
      //         right: 0,
      //         forward: 25,
      //     });
      //     expect(didHit).to.be.true;
      //     const hitMsg = conn2.msgs.find((msg) => msg.type === "puckUpdate");
      //     expect(hitMsg).to.exist;
      //     expect(hitMsg.puck.velocityX).to.equal(-25);
      //     expect(hitMsg.puck.velocityY).to.equal(0);
      // });
      it("should miss puck when outside x range", () => {
          const {game, conn1, conn2} = startGame();
          game.puck.x = 200;
          game.puck.y = game.table.height / 2;
          const didHit = game.paddleMoved(conn1, {
              left: 0,
              right: 0,
              forward: 100,
          });
          expect(didHit).to.be.false;
      });
      it("should miss puck when outside y range", () => {
          const {game, conn1, conn2} = startGame();
          game.puck.x = 40;
          game.puck.y = 100;
          const didHit = game.paddleMoved(conn1, {
              left: 0,
              right: 0,
              forward: 100,
          });
          expect(didHit).to.be.false;
      });
  });
  describe("_boundingBoxForPunt()", () => {
      it("should create bbox for right-forward hit", () => {
          const game = new Game();
          const box = game._boundingBoxForPunt({
              x: 20,
              y: 1200,
          }, {
              left: 0,
              right: 50,
              forward: 50,
          });
          // These should always stay the same.
          expect(box.topLeft).to.deep.equal({ x: 20, y: 1250 });
          expect(box.bottomLeft).to.deep.equal({ x: 20, y: 1150 });
          expect(box.topRight).to.deep.equal({x: 120, y: 1225});
          expect(box.bottomRight).to.deep.equal({x: 120, y: 1125});
      });
      it("should create bbox for left-forward hit", () => {
          const game = new Game();
          const box = game._boundingBoxForPunt({
              x: 20,
              y: 1200,
          }, {
              left: 50,
              right: 0,
              forward: 50,
          });
          // These should always stay the same.
          expect(box.topLeft).to.deep.equal({ x: 20, y: 1250 });
          expect(box.bottomLeft).to.deep.equal({ x: 20, y: 1150 });
          expect(box.topRight).to.deep.equal({x: 120, y: 1275 });
          expect(box.bottomRight).to.deep.equal({x: 120, y: 1175 });
      });
  });
});
