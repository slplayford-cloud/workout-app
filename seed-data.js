// Shared seed data: muscle taxonomy, default exercises, example routines.
// Used by the app for first-run seeding (both Supabase and local mode) and by
// build-schema.mjs to generate the taxonomy inserts in schema.sql.
(function (root) {
  const GROUPS = [
    // id, name, region, sub-groups [id, name]
    ['chest', 'Chest', 'upper', [['clavicular', 'Clavicular (upper)'], ['sternocostal', 'Sternocostal (mid)'], ['abdominal', 'Abdominal (lower)']]],
    ['shoulders', 'Shoulders', 'upper', [['anterior', 'Anterior delt'], ['lateral', 'Lateral delt'], ['rear', 'Rear delt']]],
    ['back', 'Back', 'upper', [['lats', 'Lats + teres major'], ['midtraps', 'Mid traps / rhomboids'], ['uppertraps', 'Upper traps'], ['lowertraps', 'Lower traps']]],
    ['biceps', 'Biceps / elbow flexors', 'upper', [['longhead', 'Long head'], ['shorthead', 'Short head'], ['brachialis', 'Brachialis'], ['brachioradialis', 'Brachioradialis']]],
    ['triceps', 'Triceps', 'upper', [['longhead', 'Long head'], ['lateralmedial', 'Lateral + medial heads']]],
    ['forearms', 'Forearms', 'upper', [['flexors', 'Wrist flexors'], ['extensors', 'Wrist extensors']]],
    ['rotatorcuff', 'Rotator cuff', 'upper', [['infraspinatus', 'Infraspinatus'], ['teresminor', 'Teres minor']]],
    ['quads', 'Quads', 'lower', [['rectusfemoris', 'Rectus femoris'], ['vasti', 'Vasti']]],
    ['hamstrings', 'Hamstrings', 'lower', [['bflong', 'Biceps femoris long head'], ['semis', 'Semitendinosus / semimembranosus'], ['bfshort', 'Biceps femoris short head']]],
    ['glutes', 'Glutes', 'lower', [['max', 'Gluteus maximus'], ['medmin', 'Gluteus medius / minimus']]],
    ['adductors', 'Adductors', 'lower', [['magnus', 'Adductor magnus'], ['longusbrevis', 'Adductor longus / brevis']]],
    ['calves', 'Calves', 'lower', [['gastroc', 'Gastrocnemius'], ['soleus', 'Soleus']]],
    ['shins', 'Shins', 'lower', [['tibialis', 'Tibialis anterior']]],
    ['lowerback', 'Lower back', 'lower', [['erectors', 'Erector spinae']]],
    ['hipflexors', 'Hip flexors', 'lower', [['iliopsoas', 'Iliopsoas'], ['rectusfemoris', 'Rectus femoris']]],
    ['core', 'Core', 'either', [['rectus', 'Rectus abdominis'], ['obliques', 'Obliques'], ['tva', 'Transverse abdominis']]],
  ];

  // Targets: 'group.sub' = primary, 'group.sub*' = secondary (counts 0.5 set).
  // 'group' alone (no sub) is allowed.
  const EXERCISES = [
    // Chest
    ['Incline Barbell Press', 'Bench ~30°. Touch just below collarbones.', ['chest.clavicular', 'shoulders.anterior*', 'triceps.lateralmedial*']],
    ['Incline Dumbbell Press', 'Bench ~30°. Deep stretch at the bottom.', ['chest.clavicular', 'shoulders.anterior*', 'triceps.lateralmedial*']],
    ['Flat Barbell Bench Press', 'Shoulder blades pinned; touch lower sternum.', ['chest.sternocostal', 'shoulders.anterior*', 'triceps.lateralmedial*']],
    ['Flat Dumbbell Press', '', ['chest.sternocostal', 'triceps.lateralmedial*']],
    ['Machine Chest Press', '', ['chest.sternocostal', 'triceps.lateralmedial*']],
    ['Chest Dip', 'Lean forward, elbows out ~45°.', ['chest.abdominal', 'triceps.lateralmedial*']],
    ['Low-to-High Cable Fly', 'Pulleys low; finish hands at eye level.', ['chest.clavicular']],
    ['Pec Deck / Machine Fly', 'Slight elbow bend; squeeze at the midline.', ['chest.sternocostal']],
    ['High-to-Low Cable Fly', 'Pulleys high; finish hands at hips.', ['chest.abdominal']],
    ['Push-Up', '', ['chest.sternocostal', 'triceps.lateralmedial*']],
    // Shoulders
    ['Seated Dumbbell Shoulder Press', '', ['shoulders.anterior', 'shoulders.lateral*', 'triceps.lateralmedial*']],
    ['Overhead Barbell Press', 'Glutes tight; bar path close to the face.', ['shoulders.anterior', 'triceps.lateralmedial*']],
    ['Machine Shoulder Press', '', ['shoulders.anterior', 'triceps.lateralmedial*']],
    ['Dumbbell Lateral Raise', 'Lead with the elbows; slight forward lean.', ['shoulders.lateral']],
    ['Cable Lateral Raise', 'Cable behind the body; constant tension.', ['shoulders.lateral']],
    ['Machine Lateral Raise', '', ['shoulders.lateral']],
    ['Reverse Pec Deck', 'Neutral grip; elbows flared 70–90°.', ['shoulders.rear', 'back.midtraps*']],
    ['Face Pull', 'Rope to forehead; externally rotate at the end.', ['shoulders.rear', 'rotatorcuff.infraspinatus*', 'back.midtraps*']],
    ['Rear Delt Cable Fly', '', ['shoulders.rear']],
    ['Dumbbell Front Raise', '', ['shoulders.anterior']],
    // Back
    ['Neutral Close-Grip Pulldown', 'Drive elbows down to the hips; slight lean back.', ['back.lats', 'biceps.brachialis*']],
    ['Wide-Grip Lat Pulldown', 'Elbows flared 70–90°; pull to upper chest.', ['back.lats', 'back.midtraps*']],
    ['Pull-Up', '', ['back.lats', 'biceps.brachialis*']],
    ['Chin-Up', 'Supinated grip.', ['back.lats', 'biceps.shorthead*']],
    ['Single-Arm Cable Row', 'Lower fibers: pull low toward the hip, elbow tucked.', ['back.lats']],
    ['Seated Cable Row (Neutral)', 'Elbows tucked; pull to the navel.', ['back.lats', 'back.midtraps*']],
    ['Chest-Supported Row', 'Elbows flared 70–90°; squeeze shoulder blades.', ['back.midtraps', 'back.lats*', 'shoulders.rear*']],
    ['Barbell Row', '', ['back.lats', 'back.midtraps', 'lowerback.erectors*']],
    ['Dumbbell Row', '', ['back.lats', 'back.midtraps*']],
    ['Wide-Grip Seated Row', 'Elbows high; pull to the sternum.', ['back.midtraps', 'shoulders.rear*']],
    ['Straight-Arm Pulldown', '', ['back.lats']],
    ['Paused Shrug', '2 s hold at the top; straight up and down.', ['back.uppertraps']],
    ['Cable Shrug', '', ['back.uppertraps']],
    ['Prone Y-Raise', 'Thumbs up; lift from the lower traps.', ['back.lowertraps']],
    ['Conventional Deadlift', '', ['lowerback.erectors', 'glutes.max', 'hamstrings.bflong*', 'back.uppertraps*']],
    // Biceps
    ['Incline Dumbbell Curl', 'Arms hang behind the torso (long head stretch).', ['biceps.longhead']],
    ['Barbell Curl', '', ['biceps.shorthead', 'biceps.longhead']],
    ['Preacher Curl', 'Shoulder flexed; short head emphasis.', ['biceps.shorthead']],
    ['Hammer Curl', 'Neutral grip.', ['biceps.brachialis', 'biceps.brachioradialis']],
    ['Reverse Curl', 'Pronated grip.', ['biceps.brachioradialis', 'forearms.extensors*']],
    ['Cable Curl', '', ['biceps.shorthead']],
    ['Bayesian Cable Curl', 'Face away; arm behind the body.', ['biceps.longhead']],
    // Triceps
    ['Overhead Cable Extension', 'Elbows by the ears; full stretch.', ['triceps.longhead']],
    ['Skull Crusher', 'Lower behind the head for long-head stretch.', ['triceps.longhead', 'triceps.lateralmedial']],
    ['Rope Pushdown', '', ['triceps.lateralmedial']],
    ['Bar Pushdown', '', ['triceps.lateralmedial']],
    ['Close-Grip Bench Press', '', ['triceps.lateralmedial', 'chest.sternocostal*']],
    ['Dumbbell Kickback', '', ['triceps.lateralmedial']],
    // Forearms
    ['Wrist Curl', '', ['forearms.flexors']],
    ['Reverse Wrist Curl', '', ['forearms.extensors']],
    ["Farmer's Carry", '', ['forearms.flexors', 'back.uppertraps*']],
    // Rotator cuff
    ['Cable External Rotation', 'Elbow pinned at the side; slow tempo.', ['rotatorcuff.infraspinatus', 'rotatorcuff.teresminor']],
    ['Side-Lying External Rotation', '', ['rotatorcuff.infraspinatus', 'rotatorcuff.teresminor']],
    // Quads
    ['Back Squat', '', ['quads.vasti', 'glutes.max', 'adductors.magnus*']],
    ['Front Squat', 'Upright torso; knees forward.', ['quads.vasti']],
    ['Hack Squat', 'Feet low on the platform for more quad.', ['quads.vasti']],
    ['Leg Press', '', ['quads.vasti', 'glutes.max*']],
    ['Leg Extension', 'Lean back to stretch the rectus femoris.', ['quads.rectusfemoris', 'quads.vasti']],
    ['Bulgarian Split Squat', '', ['quads.vasti', 'glutes.max']],
    ['Sissy Squat', '', ['quads.rectusfemoris']],
    ['Walking Lunge', '', ['quads.vasti', 'glutes.max']],
    // Hamstrings
    ['Romanian Deadlift', 'Hips back; soft knees; bar close.', ['hamstrings.bflong', 'hamstrings.semis', 'glutes.max*']],
    ['Seated Leg Curl', 'Hip flexed = long-head stretch.', ['hamstrings.semis', 'hamstrings.bflong', 'hamstrings.bfshort']],
    ['Lying Leg Curl', '', ['hamstrings.bfshort', 'hamstrings.bflong']],
    ['Nordic Curl', '', ['hamstrings.bflong', 'hamstrings.semis']],
    ['Good Morning', '', ['hamstrings.bflong', 'lowerback.erectors*']],
    // Glutes
    ['Barbell Hip Thrust', 'Chin tucked; posterior pelvic tilt at the top.', ['glutes.max']],
    ['Cable Kickback', '', ['glutes.max']],
    ['Hip Abduction Machine', 'Lean forward for more glute med.', ['glutes.medmin']],
    ['Cable Hip Abduction', '', ['glutes.medmin']],
    ['Step-Up', '', ['glutes.max', 'quads.vasti*']],
    // Adductors
    ['Hip Adduction Machine', '', ['adductors.longusbrevis', 'adductors.magnus']],
    ['Copenhagen Plank', '', ['adductors.longusbrevis', 'core.obliques*']],
    ['Sumo Deadlift', '', ['adductors.magnus', 'glutes.max', 'quads.vasti*']],
    // Calves
    ['Standing Calf Raise', 'Straight knee; pause at the bottom.', ['calves.gastroc']],
    ['Seated Calf Raise', 'Bent knee; soleus emphasis.', ['calves.soleus']],
    ['Leg Press Calf Raise', '', ['calves.gastroc']],
    // Shins
    ['Tibialis Raise', '', ['shins.tibialis']],
    // Lower back
    ['45° Back Extension', 'Round slightly for erectors; hinge for glutes.', ['lowerback.erectors', 'glutes.max*']],
    // Hip flexors
    ['Hanging Knee Raise', '', ['hipflexors.iliopsoas', 'core.rectus*']],
    ['Cable Hip Flexion', '', ['hipflexors.iliopsoas', 'hipflexors.rectusfemoris']],
    // Core
    ['Cable Crunch', 'Flex the spine; elbows to knees.', ['core.rectus']],
    ['Hanging Leg Raise', 'Curl the pelvis up at the top.', ['core.rectus', 'hipflexors.iliopsoas*']],
    ['Ab Wheel Rollout', '', ['core.rectus', 'core.tva']],
    ['Cable Woodchop', '', ['core.obliques']],
    ['Side Plank', '', ['core.obliques', 'core.tva']],
    ['Plank', '', ['core.tva', 'core.rectus']],
    ['Pallof Press', '', ['core.obliques', 'core.tva']],
  ];

  // Routines: slots are {group, sub (optional), sets, label (optional hint)}.
  const ROUTINES = [
    ['Back B: lat paths + traps', 'Two lat paths plus upper traps.', [
      ['back', 'lats', 2, 'e.g. Neutral close-grip pulldown'],
      ['back', 'lats', 2, 'Lower fibers — e.g. Single-arm cable row'],
      ['back', 'uppertraps', 2, 'e.g. Paused shrug'],
    ]],
    ['Push A: chest + delts + triceps', '', [
      ['chest', 'clavicular', 3, 'Incline press'],
      ['chest', 'sternocostal', 2, 'Flat press or fly'],
      ['shoulders', 'lateral', 3, ''],
      ['triceps', 'longhead', 2, 'Overhead extension'],
      ['triceps', 'lateralmedial', 2, 'Pushdown'],
    ]],
    ['Legs A: quads + hams + calves', '', [
      ['quads', 'vasti', 3, 'Squat pattern'],
      ['hamstrings', 'bflong', 3, 'Hinge or leg curl'],
      ['quads', 'rectusfemoris', 2, 'Leg extension'],
      ['glutes', 'medmin', 2, 'Abduction'],
      ['calves', 'gastroc', 3, ''],
    ]],
  ];

  root.SEED = { GROUPS, EXERCISES, ROUTINES };
})(typeof window !== 'undefined' ? window : globalThis);
