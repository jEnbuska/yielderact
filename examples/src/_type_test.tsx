/* @jsxImportSource yielderact */
// This file tests whether the JSX typing works in the examples project

function* Test() {
  return (
    <>
      {/* Should work fine */}
      <div className="foo" onClick={(e) => { const t = e.target; }} />
      
      {/* Should be a TYPE ERROR - unknownProp is not valid */}
      <div unknownProp="x" />
      
      {/* Should be a TYPE ERROR - 'badtype' is not a valid input type */}
      <input type="badtype" />
      
      {/* Event should be typed (not any) */}
      <input onChange={(e) => { const v = e.currentTarget.value; }} />
    </>
  );
}
