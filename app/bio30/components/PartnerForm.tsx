"use client";

import React from 'react';
import '../styles.css';

const PartnerForm: React.FC = () => {
  return (
    <form action="/referal/send" method="POST">
      <div className="row ctr gp gp--xs">
        <input type="text" name="email" placeholder="Email" className="input" />
        <button type="submit" className="btn btn--primary">Отправить</button>
      </div>
    </form>
  );
};

export default PartnerForm;