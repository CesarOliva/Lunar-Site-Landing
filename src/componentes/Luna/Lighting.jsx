export function SunLight({ scene }) {
  const sunDirection = scene?.sun?.direction_me
  if (!sunDirection) return null

  const [meX, meY, meZ] = sunDirection
  // Usa la misma permutación ME que los marcadores del globo.
  return <directionalLight position={[meY, meZ, meX]} intensity={3.2} color="#FFF4DF" />
}

export default function Lighting({ scene }) {
  return (
    <>
      <ambientLight intensity={0.055} />
      {!scene?.sun?.direction_me && <directionalLight position={[5, 2.5, 5]} intensity={3.2} color="#FFF4DF" />}
      <hemisphereLight skyColor="#18202B" groundColor="#000000" intensity={0.035} />
    </>
  )
}
