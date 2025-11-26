import { WebSocketServer, WebSocket } from "ws"

interface Player {
  ws: WebSocket | null
  role: "attacker" | "defender"
  energy: number
  isHost: boolean
}

interface Zone {
  name: string
  compromiseLevel: number
  maxCompromise: number
  hasDefense: boolean
  defenseValue: number
  attackPower: number
}

interface HistoryEvent {
  round: number
  turn: "attacker" | "defender"
  events: string[]
}

interface GameState {
  players: Map<string, Player>
  zones: Zone[]
  currentTurn: "attacker" | "defender"
  gameStarted: boolean
  winner: "attacker" | "defender" | null
  hostRole: "attacker" | "defender"
  history: HistoryEvent[]
  roundNumber: number
}

const games = new Map<string, GameState>()
const gameRoles = new Map<string, { attacker: string | null; defender: string | null }>()

function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function createInitialZones(): Zone[] {
  return [
    { name: "Passwords", compromiseLevel: 0, maxCompromise: 6, hasDefense: false, defenseValue: 0, attackPower: 0 },
    { name: "Network", compromiseLevel: 0, maxCompromise: 6, hasDefense: false, defenseValue: 0, attackPower: 0 },
    { name: "System", compromiseLevel: 0, maxCompromise: 6, hasDefense: false, defenseValue: 0, attackPower: 0 },
    { name: "Data", compromiseLevel: 0, maxCompromise: 6, hasDefense: false, defenseValue: 0, attackPower: 0 },
  ]
}

function broadcastGameState(gameCode: string) {
  const game = games.get(gameCode)
  if (!game) return

  const stateForClients = {
    type: "gameState",
    zones: game.zones,
    currentTurn: game.currentTurn,
    gameStarted: game.gameStarted,
    winner: game.winner,
    history: game.history,
    roundNumber: game.roundNumber,
    players: {
      attacker: {
        energy: Array.from(game.players.values()).find((p) => p.role === "attacker")?.energy ?? 0,
        connected: Array.from(game.players.values()).some((p) => p.role === "attacker" && p.ws !== null),
      },
      defender: {
        energy: Array.from(game.players.values()).find((p) => p.role === "defender")?.energy ?? 0,
        connected: Array.from(game.players.values()).some((p) => p.role === "defender" && p.ws !== null),
      },
    },
  }

  game.players.forEach((player) => {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify({ ...stateForClients, yourRole: player.role, isHost: player.isHost }))
    }
  })
}

function checkWinConditions(game: GameState, turnJustEnded: "attacker" | "defender"): "attacker" | "defender" | null {
  const allZonesCompromised = game.zones.every((z) => z.compromiseLevel >= z.maxCompromise)
  if (allZonesCompromised) return "attacker"

  if (turnJustEnded === "attacker") {
    const allZonesDefended = game.zones.every((z) => z.hasDefense)
    if (allZonesDefended) return "defender"
  }

  return null
}

function resolveAttacks(game: GameState): string[] {
  const events: string[] = []

  game.zones.forEach((zone) => {
    if (zone.attackPower > 0) {
      if (zone.hasDefense) {
        if (zone.attackPower >= zone.defenseValue) {
          // Attack breaks defense: damage = (attack - defense) + 1 bonus
          const damage = zone.attackPower - zone.defenseValue + 1
          zone.compromiseLevel = Math.min(zone.maxCompromise, zone.compromiseLevel + damage)
          events.push(
            `${zone.name}: Attack (${zone.attackPower}) broke defense (${zone.defenseValue}), dealt ${damage} damage`,
          )
          zone.hasDefense = false
          zone.defenseValue = 0
        } else {
          // Attack blocked
          events.push(`${zone.name}: Attack (${zone.attackPower}) blocked by defense (${zone.defenseValue})`)
        }
      } else {
        // No defense: full attack damage
        zone.compromiseLevel = Math.min(zone.maxCompromise, zone.compromiseLevel + zone.attackPower)
        events.push(`${zone.name}: Attack (${zone.attackPower}) dealt ${zone.attackPower} damage (undefended)`)
      }
      zone.attackPower = 0
    }
  })

  return events
}

const wss = new WebSocketServer({ port: 3002 })

console.log("[Server] WebSocket server starting on port 3002...")

wss.on("connection", (ws) => {
  let currentGameCode: string | null = null
  let currentPlayerId: string | null = null

  console.log(`[Server] New connection`)

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString())
      console.log(`[Server] Message received:`, JSON.stringify(message))

      switch (message.type) {
        case "createGame": {
          const gameCode = generateGameCode()
          const role = message.role as "attacker" | "defender"
          const initialEnergy = role === "defender" ? 1 : 2
          const playerId = `${role}-host`

          games.set(gameCode, {
            players: new Map([[playerId, { ws, role, energy: initialEnergy, isHost: true }]]),
            zones: createInitialZones(),
            currentTurn: "defender",
            gameStarted: false,
            winner: null,
            hostRole: role,
            history: [],
            roundNumber: 1,
          })

          gameRoles.set(gameCode, {
            attacker: role === "attacker" ? playerId : null,
            defender: role === "defender" ? playerId : null,
          })

          currentGameCode = gameCode
          currentPlayerId = playerId
          ws.send(JSON.stringify({ type: "gameCreated", gameCode, role }))

          console.log(`[Server] GAME CREATED - Code: ${gameCode}, Role: ${role}`)

          broadcastGameState(gameCode)
          break
        }

        case "joinGame": {
          const gameCode = message.gameCode?.toUpperCase()
          console.log(`[Server] JOIN ATTEMPT - Code: "${gameCode}"`)

          const game = games.get(gameCode)

          if (!game) {
            console.log(`[Server] JOIN FAILED - Game "${gameCode}" not found`)
            ws.send(JSON.stringify({ type: "error", message: "Game not found" }))
            break
          }

          const roles = gameRoles.get(gameCode)
          if (!roles) break

          let role: "attacker" | "defender" | null = null
          if (
            !roles.attacker ||
            !Array.from(game.players.values()).some((p) => p.role === "attacker" && p.ws !== null)
          ) {
            role = "attacker"
          } else if (
            !roles.defender ||
            !Array.from(game.players.values()).some((p) => p.role === "defender" && p.ws !== null)
          ) {
            role = "defender"
          }

          if (!role) {
            console.log(`[Server] JOIN FAILED - Game "${gameCode}" is full`)
            ws.send(JSON.stringify({ type: "error", message: "Game is full" }))
            break
          }

          const initialEnergy = role === "defender" ? 1 : 2
          const playerId = `${role}-guest`

          game.players.set(playerId, { ws, role, energy: initialEnergy, isHost: false })
          if (role === "attacker") roles.attacker = playerId
          else roles.defender = playerId

          currentGameCode = gameCode
          currentPlayerId = playerId
          game.gameStarted = true

          ws.send(JSON.stringify({ type: "gameJoined", gameCode, role }))

          console.log(`[Server] GAME JOINED - Code: ${gameCode}, Role: ${role}`)

          // Small delay to ensure client has processed gameJoined before receiving gameState
          setTimeout(() => {
            broadcastGameState(gameCode)
          }, 50)
          break
        }

        case "reconnect": {
          const gameCode = message.gameCode?.toUpperCase()
          const role = message.role as "attacker" | "defender"
          console.log(`[Server] RECONNECT ATTEMPT - Code: "${gameCode}", Role: ${role}`)

          const game = games.get(gameCode)

          if (!game) {
            console.log(`[Server] RECONNECT FAILED - Game "${gameCode}" not found`)
            ws.send(JSON.stringify({ type: "error", message: "Game not found" }))
            break
          }

          let existingPlayerId: string | null = null
          let existingPlayer: Player | null = null
          game.players.forEach((player, id) => {
            if (player.role === role) {
              existingPlayerId = id
              existingPlayer = player
            }
          })

          if (existingPlayer && existingPlayerId) {
            existingPlayer.ws = ws
            currentGameCode = gameCode
            currentPlayerId = existingPlayerId
            ws.send(JSON.stringify({ type: "reconnected", gameCode, role, isHost: existingPlayer.isHost }))
            console.log(`[Server] RECONNECTED - Code: ${gameCode}, Role: ${role}`)
          } else {
            const initialEnergy = role === "defender" ? 1 : 2
            const playerId = `${role}-reconnect-${Date.now()}`
            game.players.set(playerId, { ws, role, energy: initialEnergy, isHost: false })

            const roles = gameRoles.get(gameCode)
            if (roles) {
              if (role === "attacker") roles.attacker = playerId
              else roles.defender = playerId
            }

            currentGameCode = gameCode
            currentPlayerId = playerId
            if (game.players.size >= 2) game.gameStarted = true

            ws.send(JSON.stringify({ type: "reconnected", gameCode, role, isHost: false }))
            console.log(`[Server] JOINED AS NEW - Code: ${gameCode}, Role: ${role}`)
          }

          broadcastGameState(gameCode)
          break
        }

        case "endTurn": {
          if (!currentGameCode) break
          const game = games.get(currentGameCode)
          if (!game || !currentPlayerId) break

          const player = game.players.get(currentPlayerId)
          if (!player || player.role !== game.currentTurn) break

          const previousTurn = game.currentTurn
          let turnEvents: string[] = []

          if (previousTurn === "attacker") {
            turnEvents = resolveAttacks(game)
            console.log(`[Server] Attacks resolved for game ${currentGameCode}`)

            game.roundNumber++
          } else {
            // Defender turn - record defense setup
            const defenses = game.zones.filter((z) => z.hasDefense)
            if (defenses.length > 0) {
              turnEvents = defenses.map((z) => `${z.name}: Defense set to ${z.defenseValue}`)
            } else {
              turnEvents = ["No defenses placed"]
            }
          }

          if (turnEvents.length > 0) {
            game.history.push({
              round: previousTurn === "attacker" ? game.roundNumber - 1 : game.roundNumber,
              turn: previousTurn,
              events: turnEvents,
            })
          }

          game.currentTurn = game.currentTurn === "attacker" ? "defender" : "attacker"

          game.players.forEach((p) => {
            if (p.role === game.currentTurn) {
              p.energy = Math.min(10, p.energy + 2)
            }
          })

          game.winner = checkWinConditions(game, previousTurn)

          console.log(`[Server] END TURN - Game: ${currentGameCode}`)

          broadcastGameState(currentGameCode)
          break
        }

        case "updateEnergy": {
          if (!currentGameCode || !currentPlayerId) break
          const game = games.get(currentGameCode)
          if (!game) break

          const player = game.players.get(currentPlayerId)
          if (!player) break

          player.energy = Math.max(0, Math.min(10, message.energy))

          broadcastGameState(currentGameCode)
          break
        }

        case "updateZone": {
          if (!currentGameCode || !currentPlayerId) break
          const game = games.get(currentGameCode)
          if (!game) break

          const player = game.players.get(currentPlayerId)
          if (!player) break

          const zoneIndex = message.zoneIndex
          if (zoneIndex < 0 || zoneIndex >= game.zones.length) break

          const zone = game.zones[zoneIndex]

          if (player.role === "attacker") {
            if (message.attackPower !== undefined) {
              zone.attackPower = Math.max(0, Math.min(10, message.attackPower))
            }
          } else if (player.role === "defender") {
            if (message.hasDefense !== undefined) {
              zone.hasDefense = message.hasDefense
              if (message.hasDefense && zone.defenseValue < 1) {
                zone.defenseValue = 1
              }
              if (!message.hasDefense) {
                zone.defenseValue = 0
              }
            }
            if (message.defenseValue !== undefined) {
              if (zone.hasDefense) {
                zone.defenseValue = Math.max(1, Math.min(10, message.defenseValue))
              } else {
                zone.defenseValue = 0
              }
            }
          }

          broadcastGameState(currentGameCode)
          break
        }

        case "resetGame": {
          if (!currentGameCode || !currentPlayerId) break
          const game = games.get(currentGameCode)
          if (!game) break

          const player = game.players.get(currentPlayerId)
          if (!player || !player.isHost) break

          const newHostRole = message.hostRole as "attacker" | "defender" | undefined

          game.zones = createInitialZones()
          game.currentTurn = "defender"
          game.winner = null
          game.history = []
          game.roundNumber = 1

          if (newHostRole && newHostRole !== player.role) {
            game.players.forEach((p) => {
              if (p.isHost) {
                p.role = newHostRole
                p.energy = newHostRole === "defender" ? 1 : 2
              } else {
                p.role = newHostRole === "attacker" ? "defender" : "attacker"
                p.energy = p.role === "defender" ? 1 : 2
              }
            })
            game.hostRole = newHostRole
          } else {
            game.players.forEach((p) => {
              p.energy = p.role === "defender" ? 1 : 2
            })
          }

          console.log(`[Server] GAME RESET - Code: ${currentGameCode}, Host role: ${game.hostRole}`)

          broadcastGameState(currentGameCode)
          break
        }

        case "leaveGame": {
          if (!currentGameCode || !currentPlayerId) break
          const game = games.get(currentGameCode)
          if (!game) break

          game.players.delete(currentPlayerId)
          console.log(`[Server] Player left game ${currentGameCode}`)

          if (game.players.size === 0) {
            games.delete(currentGameCode)
            gameRoles.delete(currentGameCode)
            console.log(`[Server] Game ${currentGameCode} deleted (no players)`)
          } else {
            broadcastGameState(currentGameCode)
          }

          ws.send(JSON.stringify({ type: "leftGame" }))
          currentGameCode = null
          currentPlayerId = null
          break
        }
      }
    } catch (error) {
      console.error("[Server] Error processing message:", error)
    }
  })

  ws.on("close", () => {
    console.log(`[Server] Player disconnected: ${currentPlayerId}`)

    if (currentGameCode && currentPlayerId) {
      const game = games.get(currentGameCode)
      if (game) {
        const player = game.players.get(currentPlayerId)
        if (player) {
          player.ws = null
          console.log(`[Server] Player ${currentPlayerId} marked disconnected in game ${currentGameCode}`)
          broadcastGameState(currentGameCode)
        }
      }
    }
  })

  ws.on("error", (error) => {
    console.error(`[Server] WebSocket error:`, error)
  })
})

console.log("[Server] WebSocket server running on port 3002")
