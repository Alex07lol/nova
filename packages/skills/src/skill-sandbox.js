export class SkillSandbox {
  constructor({ skill, policy, approved = false } = {}) {
    if (!skill) throw new Error('SkillSandbox requires a skill manifest');
    if (skill.activationRequiresApproval && !approved) {
      const error = new Error(`Skill activation requires approval: ${skill.id}`);
      error.code = 'SKILL_APPROVAL_REQUIRED';
      throw error;
    }
    this.skill = skill;
    this.policy = policy;
  }

  authorize(capability) {
    if (!this.skill.permissions.includes(capability)) {
      const error = new Error(`Skill ${this.skill.id} did not declare permission: ${capability}`);
      error.code = 'SKILL_CAPABILITY_UNDECLARED';
      throw error;
    }
    return this.policy ? this.policy.assert(capability) : { capability, allowed: true };
  }

  async run(capability, action) {
    this.authorize(capability);
    return action();
  }
}
