const TABLES = {
  "M/FS": [[100,197],[95,202],[90,207],[85,214],[80,222],[78,227],[76,232],[74,237],[72,242],[70,247],[68,252],[66,257],[64,262],[62,267],[60,272],[50,292],[40,312],[30,332],[20,352],[10,372]],
  "M/JS": [[100,195],[95,200],[90,205],[85,212],[80,220],[78,225],[76,230],[74,235],[72,240],[70,245],[68,250],[66,255],[64,260],[62,265],[60,270],[50,290],[40,310],[30,330],[20,350],[10,370]],
  "F/FS": [[100,198],[95,204],[90,210],[85,217],[80,224],[78,229],[76,234],[74,239],[72,244],[70,249],[68,254],[66,259],[64,264],[62,269],[60,274],[50,284],[40,294],[30,304],[20,314],[10,324]],
  "F/JS": [[100,196],[95,202],[90,208],[85,215],[80,222],[78,227],[76,232],[74,237],[72,242],[70,247],[68,252],[66,257],[64,262],[62,267],[60,272],[50,282],[40,292],[30,302],[20,312],[10,322]],
};

export function endurancePopulation(gender, gradeLevel) {
  const sex = String(gender).toLowerCase() === "male" ? "M" : "F";
  const grade = ["JS", "junior", "senior"].includes(gradeLevel) ? "JS" : "FS";
  return `${sex}/${grade}`;
}

export function localEnduranceScore({ timeSeconds, gender, gradeLevel }) {
  const population = endurancePopulation(gender, gradeLevel);
  const table = TABLES[population];
  const seconds = Number(timeSeconds);
  if (!table || !Number.isFinite(seconds) || seconds < 0) return null;
  const [score] = table.find(([, maximum]) => seconds <= maximum) || table[table.length - 1];
  const tier = score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 60 ? "pass" : "fail";
  return { score, tier, timeSeconds: seconds, gender, gradeLevel, population, source: "local" };
}
