"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Sword } from "lucide-react"
import GameBoard from "@/components/game-board"

export default function Home() {
  const [joinCode, setJoinCode] = useState("")
  const [selectedRole, setSelectedRole] = useState<"attacker" | "defender" | null>(null)
  const [mode, setMode] = useState<"menu" | "create" | "join">("menu")
  const [error, setError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  // Game state
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [gameCode, setGameCode] = useState<string | null>(null)
  const [role, setRole] = useState<"attacker" | "defender" | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [inGame, setInGame] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const connectAndSend = (message: object, expectedRole: "attacker" | "defender") => {
    setIsConnecting(true)
    setError(null)

    const socket = new WebSocket("ws://localhost:3002")
    wsRef.current = socket

    socket.onopen = () => {
      socket.send(JSON.stringify(message))
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "error") {
        setError(data.message)
        setIsConnecting(false)
        socket.close()
        return
      }

      if (data.type === "gameCreated") {
        setWs(socket)
        setGameCode(data.gameCode)
        setRole(data.role)
        setIsHost(true)
        setInGame(true)
        setIsConnecting(false)
      }

      if (data.type === "gameJoined") {
        setWs(socket)
        setGameCode(data.gameCode)
        setRole(data.role)
        setIsHost(false)
        setInGame(true)
        setIsConnecting(false)
      }
    }

    socket.onerror = () => {
      setError("Could not connect to server")
      setIsConnecting(false)
    }

    socket.onclose = () => {
      setIsConnecting(false)
    }
  }

  const handleCreateGame = (selectedRole: "attacker" | "defender") => {
    connectAndSend({ type: "createGame", role: selectedRole }, selectedRole)
  }

  const handleJoinGame = (code: string) => {
    setIsConnecting(true)
    setError(null)

    const socket = new WebSocket("ws://localhost:3002")
    wsRef.current = socket

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "joinGame", gameCode: code }))
    }

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === "error") {
        setError(data.message)
        setIsConnecting(false)
        socket.close()
        return
      }

      if (data.type === "gameJoined") {
        setWs(socket)
        setGameCode(data.gameCode)
        setRole(data.role)
        setIsHost(false)
        setInGame(true)
        setIsConnecting(false)
      }
    }

    socket.onerror = () => {
      setError("Could not connect to server")
      setIsConnecting(false)
    }

    socket.onclose = () => {
      setIsConnecting(false)
    }
  }

  const handleExit = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leaveGame" }))
      wsRef.current.close()
    }
    setWs(null)
    setGameCode(null)
    setRole(null)
    setIsHost(false)
    setInGame(false)
    setMode("menu")
    setSelectedRole(null)
    setJoinCode("")
    setError(null)
  }

  if (inGame && ws && gameCode && role) {
    return <GameBoard gameCode={gameCode} role={role} ws={ws} isHost={isHost} onExit={handleExit} />
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-foreground">SenCybility</CardTitle>
          <CardDescription className="text-muted-foreground">Cybersecurity Strategy Game</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          {mode === "menu" && (
            <>
              <Button
                className="w-full h-14 text-lg bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setMode("create")}
              >
                Create Party
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 text-lg border-border text-foreground hover:bg-accent bg-transparent"
                onClick={() => setMode("join")}
              >
                Join Party
              </Button>
            </>
          )}

          {mode === "create" && (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">Select your role:</p>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant={selectedRole === "defender" ? "default" : "outline"}
                  className={`h-24 flex flex-col gap-2 ${
                    selectedRole === "defender"
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border-border text-foreground hover:bg-accent"
                  }`}
                  onClick={() => setSelectedRole("defender")}
                >
                  <Shield className="h-8 w-8" />
                  <span>Defender</span>
                </Button>
                <Button
                  variant={selectedRole === "attacker" ? "default" : "outline"}
                  className={`h-24 flex flex-col gap-2 ${
                    selectedRole === "attacker"
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "border-border text-foreground hover:bg-accent"
                  }`}
                  onClick={() => setSelectedRole("attacker")}
                >
                  <Sword className="h-8 w-8" />
                  <span>Attacker</span>
                </Button>
              </div>
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!selectedRole || isConnecting}
                onClick={() => selectedRole && handleCreateGame(selectedRole)}
              >
                {isConnecting ? "Creating..." : "Create Party"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setMode("menu")
                  setSelectedRole(null)
                  setError(null)
                }}
              >
                Back
              </Button>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-4">
              <Input
                placeholder="Enter party code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                className="text-center text-lg uppercase tracking-widest bg-background text-foreground border-border"
                maxLength={6}
              />
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={joinCode.length < 4 || isConnecting}
                onClick={() => handleJoinGame(joinCode)}
              >
                {isConnecting ? "Joining..." : "Join Party"}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setMode("menu")
                  setJoinCode("")
                  setError(null)
                }}
              >
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
