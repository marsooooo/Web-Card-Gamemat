export function RulebookContent() {
  return (
    <div className="space-y-6 text-sm text-foreground">
      <section>
        <h3 className="font-bold text-lg mb-2">1. Objective</h3>
        <p className="text-muted-foreground">
          The game is divided into four zones: <strong className="text-foreground">Passwords</strong>,{" "}
          <strong className="text-foreground">Network</strong>, <strong className="text-foreground">System</strong>, and{" "}
          <strong className="text-foreground">Data</strong>.
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>
            <strong className="text-foreground">Attacker&apos;s goal:</strong> Reach the maximum compromise level in all
            four zones.
          </li>
          <li>
            <strong className="text-foreground">Defender&apos;s goal:</strong> Have all four zones defended (with active
            defenses) at the end of an Attacker&apos;s turn.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold text-lg mb-2">2. Setup</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>The Defender starts with 1 Energy.</li>
          <li>The Attacker starts with 2 Energy.</li>
          <li>All zones begin empty (no defenses, 0 compromise).</li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold text-lg mb-2">3. Energy System</h3>
        <p className="text-muted-foreground">Energy is the resource used to play cards.</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
          <li>At the start of each turn, gain +2 Energy (max 10).</li>
          <li>Every card has an Energy cost.</li>
          <li>
            <strong className="text-foreground">Used Energy:</strong> Some cards require discarding &quot;used
            energy&quot; which is removed permanently for that turn cycle.
          </li>
        </ul>
      </section>

      <section>
        <h3 className="font-bold text-lg mb-2">4. Zones</h3>
        <p className="text-muted-foreground">
          The Defender may have only one defense card active in each zone. The Attacker may play multiple attacks into a
          zone.
        </p>
      </section>

      <section>
        <h3 className="font-bold text-lg mb-2">5. Turn Structure</h3>
        <p className="text-muted-foreground mb-2">The Defender always plays first.</p>
        <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
          <li>
            <strong className="text-foreground">Energy Phase:</strong> Gain +2 Energy (max 10).
          </li>
          <li>
            <strong className="text-foreground">Action Phase:</strong> Play cards as long as you can pay the costs.
          </li>
          <li>
            <strong className="text-foreground">Resolution Phase (Attacker only):</strong> All attacks are resolved.
            Compare attack values to defense values.
          </li>
          <li>
            <strong className="text-foreground">End of Turn:</strong> Temporary effects expire.
          </li>
        </ol>
      </section>

      <section>
        <h3 className="font-bold text-lg mb-2">6. Scoring</h3>
        <p className="text-muted-foreground">
          The Attacker has four separate score tracks (one per zone). Each zone has a maximum compromise level of 6.
        </p>
      </section>

      <section>
        <h3 className="font-bold text-lg mb-2">7. Victory Conditions</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>
            <strong className="text-foreground">Attacker wins:</strong> All four zones at maximum compromise.
          </li>
          <li>
            <strong className="text-foreground">Defender wins:</strong> All four zones have a defense at the end of the
            Attacker&apos;s turn.
          </li>
        </ul>
      </section>
    </div>
  )
}
