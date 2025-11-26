"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shield, Sword, Zap, Book, Plus, Minus, Trophy, RotateCcw, Copy, Check, LogOut, History } from "lucide-react"
import { RulebookContent } from "@/components/rulebook"

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
  zones: Zone[]
  currentTurn: "attacker" | "defender"
  gameStarted: boolean
  winner: "attacker" | "defender" | null
  yourRole: "attacker" | "defender"
  isHost: boolean
  history: HistoryEvent[]
  roundNumber: number
  players: {
    attacker: { energy: number; connected: boolean }
    defender: { energy: number; connected: boolean }
  }
}

interface GameBoardProps {
  gameCode: string
  role: "attacker" | "defender"
  ws: WebSocket
  isHost: boolean
  onExit: () => void
}

export default function GameBoard({ gameCode, role, ws, isHost, onExit }: GameBoardProps) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [copied, setCopied] = useState(false)
  const [showRoleSelect, setShowRoleSelect] = useState(false)
  const [selectedNewRole, setSelectedNewRole] = useState<"attacker" | "defender">(role)

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data)
      if (data.type === "gameState") {
        setGameState(data)
      }
    }

    ws.addEventListener("message", handleMessage)

    return () => {
      ws.removeEventListener("message", handleMessage)
    }
  }, [ws, gameCode, role])

  const sendMessage = (message: object) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  const handleEndTurn = () => {
    sendMessage({ type: "endTurn" })
  }

  const handleUpdateEnergy = (delta: number) => {
    if (!gameState) return
    const currentEnergy = gameState.players[role].energy
    sendMessage({ type: "updateEnergy", energy: currentEnergy + delta })
  }

  const handleUpdateZone = (zoneIndex: number, updates: Partial<Zone>) => {
    sendMessage({ type: "updateZone", zoneIndex, ...updates })
  }

  const handleResetGame = (newRole?: "attacker" | "defender") => {
    sendMessage({ type: "resetGame", hostRole: newRole })
    setShowRoleSelect(false)
  }

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const currentRole = gameState?.yourRole || role

  if (!gameState) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-4">
        <Button variant="ghost" size="icon" className="absolute top-4 left-4" onClick={onExit}>
          <LogOut className="h-5 w-5" />
        </Button>

        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              currentRole === "defender"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-red-600 text-white border-red-600"
            }
          >
            {currentRole === "defender" ? <Shield className="h-3 w-3 mr-1" /> : <Sword className="h-3 w-3 mr-1" />}
            {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
          </Badge>
          <span className="text-sm text-muted-foreground font-mono">{gameCode}</span>
        </div>

        <div className="text-center">
          <p className="text-muted-foreground mb-4">Waiting for opponent to join...</p>
          <div className="flex items-center gap-2 justify-center">
            <span className="text-2xl font-mono font-bold text-foreground tracking-widest">{gameCode}</span>
            <Button variant="ghost" size="icon" onClick={copyGameCode}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Share this code with your opponent</p>
        </div>
      </div>
    )
  }

  const isMyTurn = gameState.currentTurn === currentRole
  const myEnergy = gameState.players[currentRole].energy
  const opponentEnergy = gameState.players[currentRole === "attacker" ? "defender" : "attacker"].energy
  const zonesCompromised = gameState.zones.filter((z) => z.compromiseLevel >= z.maxCompromise).length
  const zonesDefended = gameState.zones.filter((z) => z.hasDefense).length

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Winner overlay */}
      {gameState.winner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-sm text-center bg-card">
            <CardContent className="pt-6 space-y-4">
              <Trophy
                className={`h-16 w-16 mx-auto ${
                  gameState.winner === currentRole ? "text-yellow-500" : "text-muted-foreground"
                }`}
              />
              <h2 className="text-2xl font-bold text-foreground">
                {gameState.winner === currentRole ? "Victory!" : "Defeat"}
              </h2>
              <p className="text-muted-foreground">
                {gameState.winner === "attacker" ? "All zones have been compromised!" : "All zones are defended!"}
              </p>
              {isHost ? (
                showRoleSelect ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Select your role for next game:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={selectedNewRole === "defender" ? "default" : "outline"}
                        className={selectedNewRole === "defender" ? "bg-blue-600 hover:bg-blue-700" : ""}
                        onClick={() => setSelectedNewRole("defender")}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        Defender
                      </Button>
                      <Button
                        variant={selectedNewRole === "attacker" ? "default" : "outline"}
                        className={selectedNewRole === "attacker" ? "bg-red-600 hover:bg-red-700" : ""}
                        onClick={() => setSelectedNewRole("attacker")}
                      >
                        <Sword className="h-4 w-4 mr-1" />
                        Attacker
                      </Button>
                    </div>
                    <Button
                      onClick={() => handleResetGame(selectedNewRole)}
                      className="w-full bg-primary text-primary-foreground"
                    >
                      Start Game
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => setShowRoleSelect(true)} className="w-full bg-primary text-primary-foreground">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Play Again
                  </Button>
                )
              ) : (
                <p className="text-sm text-muted-foreground">Waiting for host to start next game...</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={onExit} title="Exit Game">
          <LogOut className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              currentRole === "defender"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-red-600 text-white border-red-600"
            }
          >
            {currentRole === "defender" ? <Shield className="h-3 w-3 mr-1" /> : <Sword className="h-3 w-3 mr-1" />}
            {currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}
          </Badge>
          <span className="text-sm text-muted-foreground font-mono">{gameCode}</span>
        </div>

        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="border-border bg-transparent">
                <History className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden bg-card">
              <DialogHeader>
                <DialogTitle className="text-foreground">Game History</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[60vh] pr-4">
                {gameState.history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No history yet</p>
                ) : (
                  <div className="space-y-4">
                    {[...gameState.history].reverse().map((entry, index) => (
                      <Card key={index} className="bg-muted/30">
                        <CardHeader className="py-2 pb-1">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                entry.turn === "defender"
                                  ? "bg-blue-600/20 text-blue-400 border-blue-600"
                                  : "bg-red-600/20 text-red-400 border-red-600"
                              }
                            >
                              {entry.turn === "defender" ? (
                                <Shield className="h-3 w-3 mr-1" />
                              ) : (
                                <Sword className="h-3 w-3 mr-1" />
                              )}
                              {entry.turn.charAt(0).toUpperCase() + entry.turn.slice(1)}
                            </Badge>
                            <span className="text-muted-foreground">Round {entry.round}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2">
                          <ul className="text-sm space-y-1">
                            {entry.events.map((event, eventIndex) => (
                              <li key={eventIndex} className="text-muted-foreground">
                                {event}
                              </li>
                            ))}
                          </ul>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="border-border bg-transparent">
                <Book className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-card">
              <DialogHeader>
                <DialogTitle className="text-foreground">Rulebook</DialogTitle>
              </DialogHeader>
              <RulebookContent />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Turn indicator */}
      <Card className={`mb-4 ${isMyTurn ? "border-green-500 border-2" : "border-border"}`}>
        <CardContent className="py-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Round {gameState.roundNumber}</p>
          <p className="font-semibold text-foreground">{isMyTurn ? "Your Turn" : "Opponent's Turn"}</p>
        </CardContent>
      </Card>

      {/* Energy bars */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="bg-card">
          <CardContent className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-foreground">Your Energy</span>
              </div>
              <span className="font-bold text-foreground">{myEnergy}/10</span>
            </div>
            <Progress value={myEnergy * 10} className="h-2" />
            <div className="flex justify-center gap-2 mt-2">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 border-border bg-transparent"
                onClick={() => handleUpdateEnergy(-1)}
                disabled={myEnergy <= 0}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 border-border bg-transparent"
                onClick={() => handleUpdateEnergy(1)}
                disabled={myEnergy >= 10}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardContent className="py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Opponent</span>
              </div>
              <span className="font-bold text-muted-foreground">{opponentEnergy}/10</span>
            </div>
            <Progress value={opponentEnergy * 10} className="h-2 opacity-50" />
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="bg-red-950/30 border-red-900">
          <CardContent className="py-3 text-center">
            <p className="text-sm text-red-400">Zones Compromised</p>
            <p className="text-2xl font-bold text-red-500">{zonesCompromised}/4</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-950/30 border-blue-900">
          <CardContent className="py-3 text-center">
            <p className="text-sm text-blue-400">Zones Defended</p>
            <p className="text-2xl font-bold text-blue-500">{zonesDefended}/4</p>
          </CardContent>
        </Card>
      </div>

      {/* Zones */}
      <div className="space-y-3 mb-4">
        {gameState.zones.map((zone, index) => (
          <Card key={zone.name} className="bg-card">
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-base flex items-center justify-between text-foreground">
                <span>{zone.name}</span>
                <div className="flex items-center gap-2">
                  {zone.attackPower > 0 && (
                    <Badge variant="outline" className="bg-red-600/20 text-red-400 border-red-600">
                      <Sword className="h-3 w-3 mr-1" />
                      Attack: {zone.attackPower}
                    </Badge>
                  )}
                  {zone.hasDefense && (
                    <Badge variant="outline" className="bg-blue-600/20 text-blue-400 border-blue-600">
                      <Shield className="h-3 w-3 mr-1" />
                      Defense: {zone.defenseValue}
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2 space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Compromise Level</span>
                  <span className="font-mono text-foreground">
                    {zone.compromiseLevel}/{zone.maxCompromise}
                  </span>
                </div>
                <Progress value={(zone.compromiseLevel / zone.maxCompromise) * 100} className="h-3" />
              </div>

              {currentRole === "attacker" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-400">Set Attack Power:</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 border-red-600 bg-transparent text-red-400 hover:bg-red-600/20"
                      onClick={() => handleUpdateZone(index, { attackPower: zone.attackPower - 1 })}
                      disabled={zone.attackPower <= 0 || !isMyTurn}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center font-mono text-foreground">{zone.attackPower}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-7 w-7 border-red-600 bg-transparent text-red-400 hover:bg-red-600/20"
                      onClick={() => handleUpdateZone(index, { attackPower: zone.attackPower + 1 })}
                      disabled={zone.attackPower >= 10 || !isMyTurn}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={zone.hasDefense ? "default" : "outline"}
                    className={zone.hasDefense ? "bg-blue-600 text-white hover:bg-blue-700" : "border-border"}
                    onClick={() =>
                      handleUpdateZone(index, { hasDefense: !zone.hasDefense, defenseValue: zone.hasDefense ? 0 : 1 })
                    }
                    disabled={!isMyTurn}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {zone.hasDefense ? "Remove Defense" : "Add Defense"}
                  </Button>
                  {zone.hasDefense && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-border bg-transparent"
                        onClick={() => handleUpdateZone(index, { defenseValue: zone.defenseValue - 1 })}
                        disabled={zone.defenseValue <= 1 || !isMyTurn}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-mono text-foreground">{zone.defenseValue}</span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 border-border bg-transparent"
                        onClick={() => handleUpdateZone(index, { defenseValue: zone.defenseValue + 1 })}
                        disabled={zone.defenseValue >= 10 || !isMyTurn}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* End turn button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <Button
          className={`w-full h-14 text-lg ${
            isMyTurn ? "bg-green-600 text-white hover:bg-green-700" : "bg-muted text-muted-foreground"
          }`}
          disabled={!isMyTurn}
          onClick={handleEndTurn}
        >
          {isMyTurn
            ? currentRole === "attacker"
              ? "Launch Attacks & End Turn"
              : "End My Turn"
            : "Waiting for opponent..."}
        </Button>
      </div>
    </div>
  )
}
