
export default function Lighting() {
  return (
    <>
      {/* Iluminación ambiental muy tenue */}
      <ambientLight intensity={0.055} />

      {/* Luz solar principal */}
      <directionalLight
        position={[-5, 2.5, 5]}
        intensity={3.2}
        color="#FFF4DF"
      />

      {/* Luz secundaria extremadamente tenue */}
      <hemisphereLight
        skyColor="#18202B"
        groundColor="#000000"
        intensity={0.035}
      />
    </>
  )
}
